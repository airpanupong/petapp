const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distance in kilometers between two WGS84 points. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0088;
  const dlat = rad(lat2 - lat1);
  const dlon = rad(lon2 - lon1);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dlon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Python's round(x, 2) for display distances. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
