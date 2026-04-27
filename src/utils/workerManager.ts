import type {
  DistanceWorkerInput,
  DistanceWorkerOutput,
  OrderWithDistance,
  MerchantWithDistance
} from '../workers/distanceWorker';
import type { Order, Merchant } from './indexedDB';

class WorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = new Map();
  private requestIdCounter = 0;

  private initWorker(): void {
    if (this.worker) return;

    this.worker = new Worker(
      new URL('../workers/distanceWorker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<DistanceWorkerOutput>) => {
      const output = event.data;
      const requestId = this.requestIdCounter - 1;
      const pending = this.pendingRequests.get(requestId);

      if (pending) {
        pending.resolve(output);
        this.pendingRequests.delete(requestId);
      }
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
      const requestId = this.requestIdCounter - 1;
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        pending.reject(error);
        this.pendingRequests.delete(requestId);
      }
    };
  }

  private async sendRequest<T extends DistanceWorkerOutput>(
    input: DistanceWorkerInput
  ): Promise<T> {
    this.initWorker();

    const requestId = this.requestIdCounter++;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      this.worker!.postMessage(input);
    });
  }

  async calculateOrderDistances(
    centerLat: number,
    centerLng: number,
    orders: Order[]
  ): Promise<{
    orders: OrderWithDistance[];
    executionTime: number;
    itemCount: number;
  }> {
    const result = await this.sendRequest({
      type: 'calculate_order_distances',
      centerLat,
      centerLng,
      orders: orders as OrderWithDistance[]
    });

    return {
      orders: result.items as OrderWithDistance[],
      executionTime: result.executionTime,
      itemCount: result.itemCount
    };
  }

  async calculateMerchantDistances(
    centerLat: number,
    centerLng: number,
    merchants: Merchant[]
  ): Promise<{
    merchants: MerchantWithDistance[];
    executionTime: number;
    itemCount: number;
  }> {
    const result = await this.sendRequest({
      type: 'calculate_merchant_distances',
      centerLat,
      centerLng,
      merchants: merchants as MerchantWithDistance[]
    });

    return {
      merchants: result.items as MerchantWithDistance[],
      executionTime: result.executionTime,
      itemCount: result.itemCount
    };
  }

  async sortOrdersByDistance(
    orders: OrderWithDistance[]
  ): Promise<{
    orders: OrderWithDistance[];
    executionTime: number;
    itemCount: number;
  }> {
    const result = await this.sendRequest({
      type: 'sort_by_distance',
      centerLat: 0,
      centerLng: 0,
      orders
    });

    return {
      orders: result.items as OrderWithDistance[],
      executionTime: result.executionTime,
      itemCount: result.itemCount
    };
  }

  async sortMerchantsByDistance(
    merchants: MerchantWithDistance[]
  ): Promise<{
    merchants: MerchantWithDistance[];
    executionTime: number;
    itemCount: number;
  }> {
    const result = await this.sendRequest({
      type: 'sort_by_distance',
      centerLat: 0,
      centerLng: 0,
      merchants
    });

    return {
      merchants: result.items as MerchantWithDistance[],
      executionTime: result.executionTime,
      itemCount: result.itemCount
    };
  }

  async calculateAndSortOrders(
    centerLat: number,
    centerLng: number,
    orders: Order[]
  ): Promise<{
    orders: OrderWithDistance[];
    executionTime: number;
    itemCount: number;
  }> {
    const { orders: ordersWithDistance } = await this.calculateOrderDistances(
      centerLat,
      centerLng,
      orders
    );

    const startTime = performance.now();
    const { orders: sortedOrders } = await this.sortOrdersByDistance(ordersWithDistance);

    return {
      orders: sortedOrders,
      executionTime: performance.now() - startTime,
      itemCount: sortedOrders.length
    };
  }

  async calculateAndSortMerchants(
    centerLat: number,
    centerLng: number,
    merchants: Merchant[]
  ): Promise<{
    merchants: MerchantWithDistance[];
    executionTime: number;
    itemCount: number;
  }> {
    const { merchants: merchantsWithDistance } = await this.calculateMerchantDistances(
      centerLat,
      centerLng,
      merchants
    );

    const startTime = performance.now();
    const { merchants: sortedMerchants } = await this.sortMerchantsByDistance(merchantsWithDistance);

    return {
      merchants: sortedMerchants,
      executionTime: performance.now() - startTime,
      itemCount: sortedMerchants.length
    };
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

export const workerManager = new WorkerManager();

export type { OrderWithDistance, MerchantWithDistance } from '../workers/distanceWorker';
