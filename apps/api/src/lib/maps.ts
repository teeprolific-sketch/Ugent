/* Live travel times from Google Maps (Routes API, traffic-aware). Needs GOOGLE_MAPS_API_KEY. */
import { HttpError } from './http';

export const mapsConfigured = () => !!process.env.GOOGLE_MAPS_API_KEY;

type Place = string | { lat: number; lng: number };
const waypoint = (p: Place) => (typeof p === 'string' ? { address: p } : { location: { latLng: { latitude: p.lat, longitude: p.lng } } });

export async function travelTime(origin: Place, destination: string): Promise<{ minutes: number; km: number }> {
  if (!mapsConfigured()) throw new HttpError(501, 'Live traffic times are not set up on this server yet.', 'not_configured');
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY!, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' },
    body: JSON.stringify({ origin: waypoint(origin), destination: waypoint(destination), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE' }),
  });
  if (!res.ok) throw new HttpError(502, 'Google Maps could not find that route.', 'maps_error');
  const data = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
  const r = data.routes?.[0];
  if (!r?.duration) throw new HttpError(404, 'No route found between those places.', 'no_route');
  return { minutes: Math.round(parseInt(r.duration, 10) / 60), km: Math.round((r.distanceMeters ?? 0) / 100) / 10 };
}
