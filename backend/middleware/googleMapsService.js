const axios = require("axios");

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_API_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const GEOCODE_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters
};

// Find nearby places by type
const findNearbyPlacesByType = async (lat, lng, type, radius = 500) => {
  try {
    const url = `${PLACES_API_URL}?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
    console.log(`🔍 Searching for ${type} near (${lat}, ${lng}) within ${radius}m`);
    
    const response = await axios.get(PLACES_API_URL, {
      params: {
        location: `${lat},${lng}`,
        radius,
        type,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    console.log(`📊 Google API Response for ${type}:`, {
      status: response.data.status,
      resultsCount: response.data.results?.length || 0,
      errorMessage: response.data.error_message
    });

    if (response.data.status !== "OK" && response.data.status !== "ZERO_RESULTS") {
      console.error(`❌ Google Places API error for ${type}:`, {
        status: response.data.status,
        error_message: response.data.error_message
      });
      return [];
    }

    if (response.data.status === "ZERO_RESULTS") {
      console.log(`⚠️ No ${type} found within ${radius}m`);
      return [];
    }

    return response.data.results.map((place) => ({
      name: place.name,
      vicinity: place.vicinity,
      distance: calculateDistance(
        lat,
        lng,
        place.geometry.location.lat,
        place.geometry.location.lng
      ),
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    }));
  } catch (error) {
    console.error(`❌ Error fetching ${type}:`, {
      message: error.message,
      response: error.response?.data
    });
    return [];
  }
};

// Find all nearby places for a hoarding location
const findNearbyPlaces = async (lat, lng, radius = 500) => {
  console.log('\n🗺️  === LOCATION ANALYSIS STARTED ===');
  console.log(`📍 Coordinates: (${lat}, ${lng})`);
  console.log(`📏 Radius: ${radius}m`);
  console.log(`🔑 API Key configured: ${GOOGLE_MAPS_API_KEY ? 'YES ✅' : 'NO ❌'}`);
  
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('❌ GOOGLE_MAPS_API_KEY is missing in .env file');
    throw new Error("GOOGLE_MAPS_API_KEY is not configured in environment variables");
  }

  try {
    // Fetch different types in parallel
    const [malls, shops, busStands, restaurants] = await Promise.all([
      findNearbyPlacesByType(lat, lng, "shopping_mall", radius),
      findNearbyPlacesByType(lat, lng, "store", radius),
      findNearbyPlacesByType(lat, lng, "bus_station", radius),
      findNearbyPlacesByType(lat, lng, "restaurant", radius),
    ]);

    // Calculate footfall score based on nearby places
    const totalPlaces = malls.length + shops.length + busStands.length + restaurants.length;
    let footfallCategory = "Low";
    if (totalPlaces > 50) footfallCategory = "Very High";
    else if (totalPlaces > 30) footfallCategory = "High";
    else if (totalPlaces > 15) footfallCategory = "Medium";

    console.log('\n📊 === RESULTS SUMMARY ===');
    console.log(`🏬 Malls: ${malls.length}`);
    console.log(`🏪 Shops: ${shops.length}`);
    console.log(`🚏 Bus Stands: ${busStands.length}`);
    console.log(`🍔 Restaurants: ${restaurants.length}`);
    console.log(`📈 Total Places: ${totalPlaces}`);
    console.log(`👥 Footfall: ${footfallCategory}`);
    console.log('=== ANALYSIS COMPLETE ===\n');

    // Sort by distance and limit results
    const sortedMalls = malls.sort((a, b) => a.distance - b.distance).slice(0, 5);
    const sortedShops = shops.sort((a, b) => a.distance - b.distance).slice(0, 10);
    const sortedBusStands = busStands.sort((a, b) => a.distance - b.distance).slice(0, 5);
    const sortedRestaurants = restaurants.sort((a, b) => a.distance - b.distance).slice(0, 5);

    return {
      malls: sortedMalls,
      shops: sortedShops,
      busStands: sortedBusStands,
      restaurants: sortedRestaurants,
      trafficSignals: 0, // Google Maps doesn't provide traffic signals
      totalFootfall: footfallCategory,
      counts: {
        malls: malls.length,
        shops: shops.length,
        busStands: busStands.length,
        restaurants: restaurants.length,
      },
    };
  } catch (error) {
    console.error("❌ Error in findNearbyPlaces:", error);
    throw error;
  }
};

// Geocode address to coordinates
const geocodeAddress = async (address) => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  try {
    const response = await axios.get(GEOCODE_API_URL, {
      params: {
        address,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.status !== "OK") {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const location = response.data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: response.data.results[0].formatted_address,
    };
  } catch (error) {
    console.error("Geocoding error:", error.message);
    throw error;
  }
};

// Reverse geocode coordinates to address
const reverseGeocode = async (lat, lng) => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  try {
    const response = await axios.get(GEOCODE_API_URL, {
      params: {
        latlng: `${lat},${lng}`,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.status !== "OK") {
      throw new Error(`Reverse geocoding failed: ${response.data.status}`);
    }

    return {
      formattedAddress: response.data.results[0].formatted_address,
      addressComponents: response.data.results[0].address_components,
    };
  } catch (error) {
    console.error("Reverse geocoding error:", error.message);
    throw error;
  }
};

module.exports = {
  findNearbyPlaces,
  geocodeAddress,
  reverseGeocode,
  calculateDistance,
};
