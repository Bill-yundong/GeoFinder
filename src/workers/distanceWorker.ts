import type { Order, Merchant } from '../utils/indexedDB';

export interface DistanceWorkerInput {
  type: 'calculate_order_distances' | 'calculate_merchant_distances' | 'sort_by_distance';
  centerLat: number;
  centerLng: number;
  orders?: OrderWithDistance[];
  merchants?: MerchantWithDistance[];
}

export interface OrderWithDistance extends Order {
  distance: number;
}

export interface MerchantWithDistance extends Merchant {
  distance: number;
}

export interface DistanceWorkerOutput {
  type: 'order_distances' | 'merchant_distances' | 'sorted_orders' | 'sorted_merchants';
  items: OrderWithDistance[] | MerchantWithDistance[];
  executionTime: number;
  itemCount: number;
}

function calculateEuclideanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function latLngToXY(lat: number, lng: number, centerLat: number, centerLng: number): { x: number; y: number } {
  const scaleX = 111.32 * Math.cos(centerLat * Math.PI / 180);
  const scaleY = 111.32;

  return {
    x: (lng - centerLng) * scaleX,
    y: (lat - centerLat) * scaleY
  };
}

function quickSortByDistance<T extends { distance: number }>(items: T[]): T[] {
  if (items.length <= 1) return items;

  const pivot = items[Math.floor(items.length / 2)];
  const left: T[] = [];
  const right: T[] = [];
  const equal: T[] = [];

  for (const item of items) {
    if (item.distance < pivot.distance) {
      left.push(item);
    } else if (item.distance > pivot.distance) {
      right.push(item);
    } else {
      equal.push(item);
    }
  }

  return [...quickSortByDistance(left), ...equal, ...quickSortByDistance(right)];
}

function bucketSortByDistance<T extends { distance: number }>(items: T[], maxDistance: number = 2): T[] {
  const bucketCount = Math.ceil(maxDistance * 100);
  const buckets: T[][] = new Array(bucketCount).fill(null).map(() => []);

  for (const item of items) {
    const bucketIndex = Math.min(Math.floor(item.distance * 100), bucketCount - 1);
    buckets[bucketIndex].push(item);
  }

  const result: T[] = [];
  for (const bucket of buckets) {
    if (bucket.length > 0) {
      bucket.sort((a, b) => a.distance - b.distance);
      result.push(...bucket);
    }
  }

  return result;
}

self.onmessage = function(event: MessageEvent<DistanceWorkerInput>) {
  const startTime = performance.now();
  const input = event.data;

  let output: DistanceWorkerOutput;

  switch (input.type) {
    case 'calculate_order_distances': {
      const centerXY = latLngToXY(input.centerLat, input.centerLng, input.centerLat, input.centerLng);

      const ordersWithDistance: OrderWithDistance[] = (input.orders || []).map(order => {
        const orderXY = latLngToXY(order.lat, order.lng, input.centerLat, input.centerLng);
        const distance = calculateEuclideanDistance(centerXY.x, centerXY.y, orderXY.x, orderXY.y);
        return { ...order, distance };
      });

      output = {
        type: 'order_distances',
        items: ordersWithDistance,
        executionTime: performance.now() - startTime,
        itemCount: ordersWithDistance.length
      };
      break;
    }

    case 'calculate_merchant_distances': {
      const centerXY = latLngToXY(input.centerLat, input.centerLng, input.centerLat, input.centerLng);

      const merchantsWithDistance: MerchantWithDistance[] = (input.merchants || []).map(merchant => {
        const merchantXY = latLngToXY(merchant.lat, merchant.lng, input.centerLat, input.centerLng);
        const distance = calculateEuclideanDistance(centerXY.x, centerXY.y, merchantXY.x, merchantXY.y);
        return { ...merchant, distance };
      });

      output = {
        type: 'merchant_distances',
        items: merchantsWithDistance,
        executionTime: performance.now() - startTime,
        itemCount: merchantsWithDistance.length
      };
      break;
    }

    case 'sort_by_distance': {
      const items = (input.orders || input.merchants || []) as ({ distance: number })[];

      const sortedItems = items.length > 1000
        ? bucketSortByDistance(items as any, 2)
        : quickSortByDistance(items as any);

      output = {
        type: input.orders ? 'sorted_orders' : 'sorted_merchants',
        items: sortedItems as any,
        executionTime: performance.now() - startTime,
        itemCount: sortedItems.length
      };
      break;
    }

    default:
      throw new Error(`Unknown worker input type: ${(input as any).type}`);
  }

  self.postMessage(output);
};

export {};
