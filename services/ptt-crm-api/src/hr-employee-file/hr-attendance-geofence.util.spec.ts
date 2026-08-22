import {
  distanceMeters,
  matchGeofenceSite,
  resolveGpsPunchedAt,
  shouldGpsPendingReview,
} from './hr-attendance-geofence.util';

describe('hr-attendance-geofence.util', () => {
  const site = { id: 1, name: 'VP', lat: 21.0285, lng: 105.8542, radius_m: 150 };

  it('matchGeofenceSite detects inside radius', () => {
    const out = matchGeofenceSite(21.0285, 105.8542, 20, [site]);
    expect(out.outsideGeofence).toBe(false);
    expect(out.site?.id).toBe(1);
  });

  it('matchGeofenceSite detects outside radius', () => {
    const out = matchGeofenceSite(21.05, 105.9, 10, [site]);
    expect(out.outsideGeofence).toBe(true);
    expect(out.site).toBeNull();
  });

  it('shouldGpsPendingReview when outside geofence', () => {
    expect(shouldGpsPendingReview(true, 10)).toBe(true);
    expect(shouldGpsPendingReview(false, 200, 150)).toBe(true);
    expect(shouldGpsPendingReview(false, 50, 150)).toBe(false);
  });

  it('resolveGpsPunchedAt uses server time when drift > 2 min', () => {
    const server = new Date('2026-08-19T10:00:00.000Z');
    const client = new Date('2026-08-19T09:50:00.000Z');
    const out = resolveGpsPunchedAt(client.toISOString(), server);
    expect(out.toISOString()).toBe(server.toISOString());
  });

  it('distanceMeters is zero for same point', () => {
    expect(distanceMeters(10, 106, 10, 106)).toBe(0);
  });
});
