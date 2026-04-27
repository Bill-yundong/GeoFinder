export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoHashBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export type GeoHashPrecision = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

const GEOHASH_PRECISION: Record<GeoHashPrecision, { lat: number; lng: number }> = {
  1: { lat: 23.0, lng: 23.0 },
  2: { lat: 2.8, lng: 5.6 },
  3: { lat: 0.7, lng: 0.7 },
  4: { lat: 0.087, lng: 0.18 },
  5: { lat: 0.022, lng: 0.022 },
  6: { lat: 0.0027, lng: 0.0055 },
  7: { lat: 0.00068, lng: 0.00068 },
  8: { lat: 0.000085, lng: 0.00017 },
  9: { lat: 0.000021, lng: 0.000021 },
  10: { lat: 0.00000268, lng: 0.00000536 },
  11: { lat: 0.00000067, lng: 0.00000067 },
  12: { lat: 0.000000084, lng: 0.000000168 },
};

export function encode(lat: number, lng: number, precision: GeoHashPrecision = 6): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let geohash = '';
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    let mid: number;
    if (isEven) {
      mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        ch |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      mid = (latMin + latMax) / 2;
      if (lat > mid) {
        ch |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

export function decode(geohash: string): GeoPoint {
  const bounds = getBounds(geohash);
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2
  };
}

export function getBounds(geohash: string): GeoHashBounds {
  let minLat = -90;
  let maxLat = 90;
  let minLng = -180;
  let maxLng = 180;
  let isEven = true;

  for (let i = 0; i < geohash.length; i++) {
    const ch = geohash[i];
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid geohash character: ${ch}`);

    for (let j = 4; j >= 0; j--) {
      const bit = (idx >> j) & 1;
      if (isEven) {
        const mid = (minLng + maxLng) / 2;
        if (bit === 1) {
          minLng = mid;
        } else {
          maxLng = mid;
        }
      } else {
        const mid = (minLat + maxLat) / 2;
        if (bit === 1) {
          minLat = mid;
        } else {
          maxLat = mid;
        }
      }
      isEven = !isEven;
    }
  }

  return { minLat, maxLat, minLng, maxLng };
}

export function getNeighbors(geohash: string): string[] {
  const neighbors: string[] = [];
  const directions = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  directions.forEach(([dlat, dlng]) => {
    const neighbor = getNeighbor(geohash, dlat, dlng);
    if (neighbor) neighbors.push(neighbor);
  });

  return neighbors;
}

function getNeighbor(geohash: string, dlat: number, dlng: number): string | null {
  const bounds = getBounds(geohash);
  const lat = (bounds.minLat + bounds.maxLat) / 2;
  const lng = (bounds.minLng + bounds.maxLng) / 2;

  const latDelta = (bounds.maxLat - bounds.minLat);
  const lngDelta = (bounds.maxLng - bounds.minLng);

  const newLat = lat + dlat * latDelta;
  const newLng = lng + dlng * lngDelta;

  if (newLat < -90 || newLat > 90) return null;

  return encode(newLat, newLng, geohash.length as GeoHashPrecision);
}

export function getGeohashesForRadius(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  precision: GeoHashPrecision = 6
): string[] {
  const precisionInfo = GEOHASH_PRECISION[precision];
  const latStep = precisionInfo.lat;
  const lngStep = precisionInfo.lng;

  const radiusLat = radiusKm / 111.32;
  const radiusLng = radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180));

  const geohashes: Set<string> = new Set();

  const stepsLat = Math.ceil(radiusLat / latStep) + 1;
  const stepsLng = Math.ceil(radiusLng / lngStep) + 1;

  for (let dLat = -stepsLat; dLat <= stepsLat; dLat++) {
    for (let dLng = -stepsLng; dLng <= stepsLng; dLng++) {
      const testLat = centerLat + dLat * latStep;
      const testLng = centerLng + dLng * lngStep;

      if (testLat < -90 || testLat > 90) continue;

      const distance = calculateDistance(centerLat, centerLng, testLat, testLng);

      if (distance <= radiusKm * 1.5) {
        const geohash = encode(testLat, testLng, precision);
        geohashes.add(geohash);

        const neighbors = getNeighbors(geohash);
        neighbors.forEach(n => geohashes.add(n));
      }
    }
  }

  return Array.from(geohashes).filter(g => g && typeof g === 'string' && g.length > 0);
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function euclideanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
