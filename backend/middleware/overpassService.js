const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const buildAroundQuery = (lat, lon, radius, filters) => {
    const parts = filters.map(f => `node(around:${radius},${lat},${lon})[${f}];way(around:${radius},${lat},${lon})[${f}];relation(around:${radius},${lat},${lon})[${f}];`);
    const union = parts.join('\n');
    return `[
out:json][timeout:25];
(
${union}
);
out center 50;`;
};

const fetchCategory = async (lat, lon, radius, tagExpressions) => {
    const query = buildAroundQuery(lat, lon, radius, tagExpressions);
    try {
        const res = await axios.post(OVERPASS_URL, query, { headers: { 'Content-Type': 'text/plain' }, timeout: 30000 });
        const elements = res.data && res.data.elements ? res.data.elements : [];

        const mapped = elements.map(e => {
            const latVal = e.lat || (e.center && e.center.lat) || (e.geometry && e.geometry[0] && e.geometry[0].lat) || null;
            const lonVal = e.lon || (e.center && e.center.lon) || (e.geometry && e.geometry[0] && e.geometry[0].lon) || null;
            return {
                id: e.id,
                name: e.tags && (e.tags.name || e.tags.ref) || 'Unknown',
                tags: e.tags || {},
                lat: latVal,
                lng: lonVal,
                raw: e
            };
        });

        return mapped;
    } catch (err) {
        console.error('Overpass query failed:', err.message || err);
        return [];
    }
};

const findNearbyOverpass = async (lat, lon, radius = 500, categories = []) => {
    // categories: friendly keys like ['hospital','mall','busstand','traffic_signal','landmark']
    const results = {};

    for (const cat of categories) {
        if (cat === 'hospital') {
            results[cat] = await fetchCategory(lat, lon, radius, ['amenity=hospital']);
        } else if (cat === 'busstand' || cat === 'bus_station') {
            results[cat] = await fetchCategory(lat, lon, radius, ['highway=bus_stop']);
        } else if (cat === 'traffic_signal' || cat === 'signal') {
            results[cat] = await fetchCategory(lat, lon, radius, ['highway=traffic_signals']);
        } else if (cat === 'mall' || cat === 'shopping') {
            // malls are shops or shopping centers
            results[cat] = await fetchCategory(lat, lon, radius, ['shop=mall', 'shop=supermarket', 'shop=department_store']);
        } else if (cat === 'landmark') {
            results[cat] = await fetchCategory(lat, lon, radius, ['tourism=attraction', 'historic=yes']);
        } else {
            // default generic search by name tag matching category
            results[cat] = await fetchCategory(lat, lon, radius, [`name~"${cat}",i`]);
        }
    }

    const counts = Object.fromEntries(Object.keys(results).map(k => [k, results[k].length]));
    const suggestions = [];
    for (const arr of Object.values(results)) {
        for (const item of arr) {
            if (suggestions.length >= 10) break;
            if (item.name && !suggestions.find(s => s.name === item.name)) suggestions.push(item);
        }
        if (suggestions.length >= 10) break;
    }

    return { results, counts, suggestions };
};

module.exports = { findNearbyOverpass };
