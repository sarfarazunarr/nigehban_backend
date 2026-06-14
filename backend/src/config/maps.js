const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'mock_maps_key';
const IS_MOCK_MAPS = GOOGLE_MAPS_API_KEY === 'mock_maps_key';

if (IS_MOCK_MAPS) {
  console.log('Google Maps API key not configured. Running in MOCK maps mode.');
} else {
  console.log('Google Maps API configured and ready.');
}

module.exports = {
  GOOGLE_MAPS_API_KEY,
  IS_MOCK_MAPS
};
