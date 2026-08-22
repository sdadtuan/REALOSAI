export type GeofenceSite = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
};

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function matchGeofenceSite(
  lat: number,
  lng: number,
  accuracyM: number | null | undefined,
  sites: GeofenceSite[],
): { site: GeofenceSite | null; outsideGeofence: boolean; distanceM: number | null } {
  if (!sites.length) {
    return { site: null, outsideGeofence: true, distanceM: null };
  }

  let best: { site: GeofenceSite; distanceM: number } | null = null;
  for (const site of sites) {
    const d = distanceMeters(lat, lng, site.lat, site.lng);
    if (!best || d < best.distanceM) best = { site, distanceM: d };
  }
  if (!best) return { site: null, outsideGeofence: true, distanceM: null };

  const accuracy = Number.isFinite(Number(accuracyM)) ? Math.max(0, Number(accuracyM)) : 0;
  const effectiveRadius = best.site.radius_m + Math.min(accuracy, best.site.radius_m);
  const inside = best.distanceM <= effectiveRadius;
  return {
    site: inside ? best.site : null,
    outsideGeofence: !inside,
    distanceM: best.distanceM,
  };
}

export function shouldGpsPendingReview(
  outsideGeofence: boolean,
  accuracyM: number | null | undefined,
  radiusM = 150,
): boolean {
  if (outsideGeofence) return true;
  const accuracy = Number(accuracyM);
  if (!Number.isFinite(accuracy)) return false;
  return accuracy > radiusM;
}

export function resolveGpsPunchedAt(clientIso: string | undefined, serverNow = new Date()): Date {
  if (!clientIso) return serverNow;
  const client = new Date(clientIso);
  if (Number.isNaN(client.getTime())) return serverNow;
  const driftMs = Math.abs(serverNow.getTime() - client.getTime());
  return driftMs > 2 * 60 * 1000 ? serverNow : client;
}
