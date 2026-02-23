const axios = require('axios');

const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
];

// Simple in-memory cache to stabilize repeated queries: { key: { ts, data } }
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const cache = new Map();

const cacheGet = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
};

const cacheSet = (key, data) => {
    cache.set(key, { ts: Date.now(), data });
};

// Optional Mappls (MapmyIndia / Mappls) provider configuration
// You can provide either:
// - MAPPLS_BASE_URL and MAPPLS_API_KEY environment variables, or
// - MAPPLS_SDK_URL containing an `access_token` query param (the SDK URL you pasted)
const MAPPLS_SDK_URL = process.env.MAPPLS_SDK_URL || null;
let MAPPLS_BASE_URL = process.env.MAPPLS_BASE_URL || 'https://apis.mappls.com/places/v1';
let MAPPLS_API_KEY = process.env.MAPPLS_API_KEY || process.env.MAPPLS_KEY || null;

// If user supplied the SDK URL (e.g. https://sdk.mappls.com/map/sdk/web?...&access_token=KEY), extract the token
if (!MAPPLS_API_KEY && MAPPLS_SDK_URL) {
    try {
        const urlObj = new URL(MAPPLS_SDK_URL);
        const token = urlObj.searchParams.get('access_token') || urlObj.searchParams.get('access_token'.toLowerCase());
        if (token) MAPPLS_API_KEY = token;
    } catch (e) {
        // ignore parse errors
    }
}

// Try Mappls Places 'around' search for counts (very lightweight) if configured.
async function fetchCountForCategoryMappls(lat, lon, radius, tagExpression) {
    if (!MAPPLS_BASE_URL || !MAPPLS_API_KEY) return null;

    try {
        // Derive a free-text query from tagExpression when possible
        // e.g. 'amenity=hospital' -> q='hospital'
        let q = tagExpression;
        if (typeof tagExpression === 'string' && tagExpression.includes('=')) {
            q = tagExpression.split('=')[1];
        }

        const url = `${MAPPLS_BASE_URL.replace(/\/$/, '')}/search/around`;
        const params = {
            key: MAPPLS_API_KEY,
            lat,
            lon,
            radius,
            q
        };

        const resp = await axios.get(url, { params, timeout: 5000 });
        // Mappls responses vary; try common shapes
        const data = resp && resp.data ? resp.data : null;
        if (!data) return 0;

        // If API returns count or total
        if (typeof data.count === 'number') return data.count;
        if (typeof data.total === 'number') return data.total;

        // If results array exists, return its length
        if (Array.isArray(data.results)) return data.results.length;
        if (Array.isArray(data.place)) return data.place.length;

        return 0;
    } catch (err) {
        console.warn('Mappls count request failed, falling back to Overpass:', err.message || err);
        return null;
    }
}

// Try Mappls for detailed category items when configured.
async function fetchCategoryMappls(lat, lon, radius, tagExpressions) {
    if (!MAPPLS_BASE_URL || !MAPPLS_API_KEY) return null;

    try {
        // pick the first tag expression and derive a query
        let first = (Array.isArray(tagExpressions) && tagExpressions.length > 0) ? tagExpressions[0] : tagExpressions;
        let q = first;
        if (typeof first === 'string' && first.includes('=')) q = first.split('=')[1];

        const url = `${MAPPLS_BASE_URL.replace(/\/$/, '')}/search/around`;
        const params = {
            key: MAPPLS_API_KEY,
            lat,
            lon,
            radius,
            q,
            limit: 50
        };

        const resp = await axios.get(url, { params, timeout: 7000 });
        const data = resp && resp.data ? resp.data : null;
        if (!data) return [];

        const items = (Array.isArray(data.results) ? data.results : (Array.isArray(data.place) ? data.place : []) ).map((p) => {
            const latv = p.latitude || p.lat || (p.geometry && p.geometry.coordinates && p.geometry.coordinates[1]) || null;
            const lngv = p.longitude || p.lon || (p.geometry && p.geometry.coordinates && p.geometry.coordinates[0]) || null;
            return {
                id: p.id || `${p.name || 'poi'}_${latv}_${lngv}`,
                name: p.name || p.title || p.subTitle || 'Unknown',
                tags: p.tags || p.category || {},
                lat: latv,
                lng: lngv,
                raw: p
            };
        }).filter(it => it.lat !== null && it.lng !== null);

        return items;
    } catch (err) {
        console.warn('Mappls detail request failed, falling back to Overpass:', err.message || err);
        return [];
    }
}

const buildAroundQuery = (lat, lon, radius, filters) => {
    // filters is an array of tag expressions; join them into unioned queries
    const parts = filters.map(f => `node(around:${radius},${lat},${lon})[${f}];way(around:${radius},${lat},${lon})[${f}];relation(around:${radius},${lat},${lon})[${f}];`);
    const union = parts.join('\n');
    return `[
out:json][timeout:25];
(
${union}
);
out center;`;
};

const fetchCategory = async (lat, lon, radius, tagExpressions) => {
    // If Mappls is configured, try it first for faster responses
    try {
        const mapplsItems = await fetchCategoryMappls(lat, lon, radius, tagExpressions);
        if (Array.isArray(mapplsItems) && mapplsItems.length > 0) {
            return mapplsItems;
        }
    } catch (e) {
        // ignore and continue to Overpass
    }

    const query = buildAroundQuery(lat, lon, radius, tagExpressions);
    try {
        const cacheKey = `q:${lat}:${lon}:${radius}:${tagExpressions.join('|')}`;
        const cached = cacheGet(cacheKey);
        if (cached) return cached;

        // Try multiple Overpass endpoints with retry/backoff
        const tryPostOverpass = async (q) => {
            for (const url of OVERPASS_ENDPOINTS) {
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        const resp = await axios.post(url, q, { headers: { 'Content-Type': 'text/plain' }, timeout: 10000 });
                        return resp;
                    } catch (err) {
                        const status = err.response?.status;
                        const body = err.response?.data;
                        const serverBusy = typeof body === 'string' && body.includes('Dispatcher_Client::request_read_and_idx::timeout');
                        // Retry on 429/504 or known server-busy HTML response
                        if (status === 429 || status === 504 || serverBusy) {
                            const backoff = Math.min(500 * Math.pow(2, attempt), 2000) + Math.floor(Math.random() * 200);
                            await new Promise(r => setTimeout(r, backoff));
                            continue;
                        }
                        // Otherwise, break and try next endpoint
                        break;
                    }
                }
            }
            throw new Error('Overpass: all endpoints failed after retries');
        };

        let res = null;
        try {
            res = await tryPostOverpass(query);
        } catch (e) {
            // primary union query failed; continue to attempt lightweight fallbacks below
            res = null;
        }
        // If server returned HTML/XML error page, treat as failure
        const contentType = (res && res.headers && res.headers['content-type']) ? String(res.headers['content-type']) : '';
        if (contentType.includes('xml') || contentType.includes('html')) {
            console.warn('Overpass returned HTML/XML error response, treating as empty result');
            return [];
        }
        const elements = res && res.data && res.data.elements ? res.data.elements : [];

        // If no results and this was a traffic_signals query, try a lightweight node-only query
        if ((elements.length === 0) && tagExpressions.some(t => t.includes('traffic_signals'))) {
            try {
                const lightQuery = `[
out:json][timeout:10];
node(around:${radius},${lat},${lon})[highway=traffic_signals];
out;`;
                const lightRes = await tryPostOverpass(lightQuery);
                if (lightRes && lightRes.data && Array.isArray(lightRes.data.elements) && lightRes.data.elements.length > 0) {
                    const lightElements = lightRes.data.elements;
                    const mappedLight = lightElements.map(e => ({
                        id: `${e.type || 'node'}_${e.id}`,
                        name: e.tags && (e.tags.name || e.tags.ref) || 'Traffic Signal',
                        tags: e.tags || {},
                        lat: e.lat || null,
                        lng: e.lon || null,
                        raw: e
                    })).filter(p => p.lat !== null && p.lng !== null);
                    cacheSet(cacheKey, mappedLight);
                    return mappedLight;
                }
            } catch (lfErr) {
                // ignore lightweight fallback errors and return empty
            }
        }

        const mapped = elements.map(e => {
            const latVal = e.lat || (e.center && e.center.lat) || (e.geometry && e.geometry[0] && e.geometry[0].lat) || null;
            const lonVal = e.lon || (e.center && e.center.lon) || (e.geometry && e.geometry[0] && e.geometry[0].lon) || null;
            return {
                id: `${e.type || 'node'}_${e.id}`,
                name: e.tags && (e.tags.name || e.tags.ref) || 'Unknown',
                tags: e.tags || {},
                lat: latVal,
                lng: lonVal,
                raw: e
            };
        }).filter(p => p.lat !== null && p.lng !== null);

        // store in cache
        cacheSet(cacheKey, mapped);
        return mapped;
    } catch (err) {
        console.error('Overpass query failed:', err.response?.data || err.message || err);
        return [];
    }
};

// Lightweight count-only query per category to reduce latency
const fetchCountForCategory = async (lat, lon, radius, tagExpression) => {
    // Try Mappls first (if configured) for a fast count
    try {
        const mp = await fetchCountForCategoryMappls(lat, lon, radius, tagExpression);
        if (typeof mp === 'number') return mp;
    } catch (e) {
        // ignore and fallback to Overpass
    }

    const query = `[
out:json][timeout:10];
(
node(around:${radius},${lat},${lon})[${tagExpression}];
way(around:${radius},${lat},${lon})[${tagExpression}];
relation(around:${radius},${lat},${lon})[${tagExpression}];
);
out count;`;

    // Try endpoints quickly
    for (const url of OVERPASS_ENDPOINTS) {
        try {
            const res = await axios.post(url, query, { headers: { 'Content-Type': 'text/plain' }, timeout: 5000 });
            const elems = res && res.data && res.data.elements ? res.data.elements : [];
            if (elems.length > 0 && elems[0].tags && elems[0].tags.total) {
                return Number(elems[0].tags.total) || 0;
            }
            // Some servers return count in 'elements[0].count' or 'elements[0].tags' may be absent
            if (elems.length > 0 && typeof elems[0].count === 'number') {
                return elems[0].count;
            }
            // fallback: if elements is empty, treat as 0
            return 0;
        } catch (err) {
            // try next endpoint quickly
            continue;
        }
    }
    return 0;
};

const findNearbyCounts = async (lat, lon, radius = 1000, categories = []) => {
    const mapping = {
        hospital: ['amenity=hospital','healthcare=hospital','building=hospital'],
        busstand: ['highway=bus_stop','public_transport=platform'],
        traffic_signal: ['highway=traffic_signals'],
        mall: ['shop=mall','shop=supermarket','shop=department_store','leisure=shopping_center'],
        landmark: ['tourism=attraction','historic=yes','historic=memorial']
    };

    const promises = categories.map(cat => {
        const key = String(cat).toLowerCase();
        const tags = mapping[key] || [`name~"${cat}",i`];
        // count for combined tag expressions by summing counts for each tag expression in parallel
        const tagPromises = tags.map(t => fetchCountForCategory(lat, lon, radius, t));
        return Promise.all(tagPromises).then(results => ({ cat, count: results.reduce((a,b)=>a+b,0) })).catch(() => ({ cat, count: 0 }));
    });

    const resolved = await Promise.all(promises);
    const counts = Object.fromEntries(resolved.map(r => [r.cat, r.count]));
    return counts;
};

const findNearbyOverpass = async (lat, lon, radius = 1000, categories = []) => {
    const results = {};

    // expanded tag mapping to improve coverage and consistency
    const mapping = {
        hospital: ['amenity=hospital','healthcare=hospital','building=hospital'],
        busstand: ['highway=bus_stop','public_transport=platform'],
        traffic_signal: ['highway=traffic_signals'],
        mall: ['shop=mall','shop=supermarket','shop=department_store','leisure=shopping_center'],
        landmark: ['tourism=attraction','historic=yes','historic=memorial']
    };

    // fetch categories in parallel to reduce overall latency
    const categoryPromises = categories.map(cat => {
        const key = String(cat).toLowerCase();
        const tags = mapping[key] || [`name~"${cat}",i`];
        return fetchCategory(lat, lon, radius, tags).then(items => ({ cat, items })).catch(err => {
            console.warn(`Overpass category ${cat} failed:`, err.message || err);
            return { cat, items: [] };
        });
    });

    const categoryResults = await Promise.all(categoryPromises);

    for (const { cat, items } of categoryResults) {
        // normalize: dedupe by name+coords, compute distance and sort
        const seen = new Map();
        const normalized = items.map(it => {
            const name = (it.name || 'Unknown').trim();
            const latv = Number(it.lat);
            const lngv = Number(it.lng);
            const dist = haversineDistanceMeters(lat, lon, latv, lngv);
            const id = `${name.toLowerCase()}::${latv.toFixed(6)}::${lngv.toFixed(6)}`;
            return { ...it, name, lat: latv, lng: lngv, distance: dist, dedupeId: id };
        }).filter(it => it.lat && it.lng);

        normalized.sort((a,b) => a.distance - b.distance);

        const deduped = [];
        for (const it of normalized) {
            if (!seen.has(it.dedupeId)) {
                seen.set(it.dedupeId, true);
                deduped.push(it);
            }
        }

        results[cat] = deduped;
    }

    const counts = Object.fromEntries(Object.keys(results).map(k => [k, results[k].length]));

    // suggestions: pick nearest unique places across categories
    const suggestions = [];
    const suggestionSet = new Set();
    const allItems = Object.values(results).flat();
    allItems.sort((a,b) => a.distance - b.distance);
    for (const item of allItems) {
        if (suggestions.length >= 10) break;
        const key = `${item.name}::${item.lat.toFixed(6)}::${item.lng.toFixed(6)}`;
        if (!suggestionSet.has(key)) {
            suggestionSet.add(key);
            suggestions.push({ name: item.name, lat: item.lat, lng: item.lng, distance: item.distance, tags: item.tags });
        }
    }

    return { results, counts, suggestions };
};

module.exports = { findNearbyOverpass, findNearbyCounts };

// Haversine distance in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    if (!lat2 || !lon2) return Number.MAX_SAFE_INTEGER;
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2-lat1) * Math.PI / 180;
    const Δλ = (lon2-lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)*Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
}
