/**
 * Shared Google Maps URL parsing utilities
 */

/**
 * Extract lat/lng from a full Google Maps URL.
 * Handles: @lat,lng  |  ?q=lat,lng  |  ll=lat,lng  |  !3d<lat>!4d<lng>
 */
export function parseGoogleMapsLink(url: string): { lat: number; lng: number } | null {
  const valid = (lat: number, lng: number) =>
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  // @lat,lng (place URLs)
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // ?q=lat,lng or &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) {
    const lat = parseFloat(llMatch[1]);
    const lng = parseFloat(llMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  // !3d<lat>!4d<lng>  (data parameter)
  const dataMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (valid(lat, lng)) return { lat, lng };
  }

  return null;
}
