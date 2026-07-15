import { Coordinate, DetectedLocation } from './storage';

/**
 * Extracts the first valid latitude/longitude pair from a given text string.
 * This will match raw coordinates or coordinates embedded within Google Maps URLs.
 */
export const extractCoordinates = (text: string): Coordinate | null => {
  if (!text) return null;

  // Matches a decimal number, optional whitespace, comma, optional whitespace, decimal number
  // Examples: 11.809477,75.481735 | 11.809477, 75.481735 | ?q=11.809477,75.481735
  const regex = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/g;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);

    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
};

/**
 * Performs reverse geocoding using the public Nominatim API.
 */
export const reverseGeocode = async (coordinate: Coordinate): Promise<DetectedLocation> => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coordinate.lat}&lon=${coordinate.lng}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        // Provide a user agent to comply with Nominatim's usage policy
        'User-Agent': 'MapMyBlock-Census2027/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.display_name) {
      throw new Error('No location found for these coordinates.');
    }

    return {
      lat: coordinate.lat,
      lng: coordinate.lng,
      displayName: data.display_name
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
};
