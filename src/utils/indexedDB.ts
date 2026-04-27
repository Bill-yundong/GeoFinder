import { encode, getGeohashesForRadius, calculateDistance } from './geohash';
import type { GeoHashPrecision } from './geohash';

export interface Order {
  id: string;
  merchantId: string;
  merchantName: string;
  lat: number;
  lng: number;
  geohash: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  orderAmount: number;
  estimatedDeliveryTime: number;
}

export interface Merchant {
  id: string;
  name: string;
  lat: number;
  lng: number;
  geohash: string;
  rating: number;
  orderCount: number;
  isActive: boolean;
}

interface DatabaseStats {
  totalOrders: number;
  activeOrders: number;
  totalMerchants: number;
  activeMerchants: number;
}

type StoreType = 'orders' | 'merchants';

const DB_NAME = 'GeoFinderDB';
const DB_VERSION = 1;
const GEOHASH_PRECISION: GeoHashPrecision = 6;

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('orders')) {
          const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
          orderStore.createIndex('geohash', 'geohash', { unique: false });
          orderStore.createIndex('status', 'status', { unique: false });
          orderStore.createIndex('createdAt', 'createdAt', { unique: false });
          orderStore.createIndex('geohash_status', ['geohash', 'status'], { unique: false });
          orderStore.createIndex('status_createdAt', ['status', 'createdAt'], { unique: false });
        }

        if (!db.objectStoreNames.contains('merchants')) {
          const merchantStore = db.createObjectStore('merchants', { keyPath: 'id' });
          merchantStore.createIndex('geohash', 'geohash', { unique: false });
          merchantStore.createIndex('isActive', 'isActive', { unique: false });
          merchantStore.createIndex('geohash_active', ['geohash', 'isActive'], { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private getTransaction(storeNames: StoreType | StoreType[], mode: IDBTransactionMode): IDBTransaction {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(
      Array.isArray(storeNames) ? storeNames : [storeNames],
      mode
    );
  }

  private getStore(transaction: IDBTransaction, storeName: StoreType): IDBObjectStore {
    return transaction.objectStore(storeName);
  }

  async addOrder(order: Omit<Order, 'geohash'>): Promise<void> {
    await this.init();
    const geohash = encode(order.lat, order.lng, GEOHASH_PRECISION);
    const orderWithGeohash: Order = { ...order, geohash };

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('orders', 'readwrite');
      const store = this.getStore(transaction, 'orders');
      const request = store.put(orderWithGeohash);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addOrders(orders: Omit<Order, 'geohash'>[]): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('orders', 'readwrite');
      const store = this.getStore(transaction, 'orders');

      let completed = 0;
      const total = orders.length;

      if (total === 0) {
        resolve();
        return;
      }

      const checkComplete = () => {
        completed++;
        if (completed >= total) {
          resolve();
        }
      };

      orders.forEach(order => {
        const geohash = encode(order.lat, order.lng, GEOHASH_PRECISION);
        const orderWithGeohash: Order = { ...order, geohash };
        const request = store.put(orderWithGeohash);
        request.onsuccess = checkComplete;
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getOrder(id: string): Promise<Order | undefined> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('orders', 'readonly');
      const store = this.getStore(transaction, 'orders');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<void> {
    await this.init();
    const order = await this.getOrder(id);
    if (!order) throw new Error(`Order not found: ${id}`);

    order.status = status;
    order.updatedAt = Date.now();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('orders', 'readwrite');
      const store = this.getStore(transaction, 'orders');
      const request = store.put(order);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteOrder(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('orders', 'readwrite');
      const store = this.getStore(transaction, 'orders');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async queryOrdersByGeohash(geohashes: string[], status?: Order['status']): Promise<Order[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('orders', 'readonly');
      const store = this.getStore(transaction, 'orders');
      const results: Order[] = [];

      const index = status
        ? store.index('geohash_status')
        : store.index('geohash');

      const validGeohashes = geohashes.filter(g => 
        g && typeof g === 'string' && g.length > 0 && /^[0-9bcdefghjkmnpqrstuvwxyz]+$/.test(g)
      );

      let processed = 0;
      const total = validGeohashes.length;

      if (total === 0) {
        resolve([]);
        return;
      }

      let hasError = false;

      validGeohashes.forEach(geohash => {
        try {
          const key = status ? [geohash, status] : geohash;
          const keyRange = IDBKeyRange.only(key);
          const request = index.openCursor(keyRange);

          request.onsuccess = (event) => {
            if (hasError) return;
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              processed++;
              if (processed >= total) {
                resolve(results);
              }
            }
          };

          request.onerror = () => {
            hasError = true;
            resolve(results);
          };
        } catch (error) {
          processed++;
          if (processed >= total) {
            resolve(results);
          }
        }
      });
    });
  }

  async queryOrdersInRadius(
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    status?: Order['status']
  ): Promise<Order[]> {
    const geohashes = getGeohashesForRadius(centerLat, centerLng, radiusKm, GEOHASH_PRECISION);
    const orders = await this.queryOrdersByGeohash(geohashes, status);

    return orders.filter(order => {
      const distance = calculateDistance(centerLat, centerLng, order.lat, order.lng);
      return distance <= radiusKm;
    });
  }

  async addMerchant(merchant: Omit<Merchant, 'geohash'>): Promise<void> {
    await this.init();
    const geohash = encode(merchant.lat, merchant.lng, GEOHASH_PRECISION);
    const merchantWithGeohash: Merchant = { ...merchant, geohash };

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('merchants', 'readwrite');
      const store = this.getStore(transaction, 'merchants');
      const request = store.put(merchantWithGeohash);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addMerchants(merchants: Omit<Merchant, 'geohash'>[]): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('merchants', 'readwrite');
      const store = this.getStore(transaction, 'merchants');

      let completed = 0;
      const total = merchants.length;

      if (total === 0) {
        resolve();
        return;
      }

      const checkComplete = () => {
        completed++;
        if (completed >= total) {
          resolve();
        }
      };

      merchants.forEach(merchant => {
        const geohash = encode(merchant.lat, merchant.lng, GEOHASH_PRECISION);
        const merchantWithGeohash: Merchant = { ...merchant, geohash };
        const request = store.put(merchantWithGeohash);
        request.onsuccess = checkComplete;
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getMerchant(id: string): Promise<Merchant | undefined> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('merchants', 'readonly');
      const store = this.getStore(transaction, 'merchants');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async queryActiveMerchantsInRadius(
    centerLat: number,
    centerLng: number,
    radiusKm: number
  ): Promise<Merchant[]> {
    const geohashes = getGeohashesForRadius(centerLat, centerLng, radiusKm, GEOHASH_PRECISION);
    await this.init();

    const merchants: Merchant[] = await new Promise((resolve, reject) => {
      const transaction = this.getTransaction('merchants', 'readonly');
      const store = this.getStore(transaction, 'merchants');
      const results: Merchant[] = [];

      const index = store.index('geohash');

      const validGeohashes = geohashes.filter(g => 
        g && typeof g === 'string' && g.length > 0 && /^[0-9bcdefghjkmnpqrstuvwxyz]+$/.test(g)
      );

      let processed = 0;
      const total = validGeohashes.length;

      if (total === 0) {
        resolve([]);
        return;
      }

      validGeohashes.forEach(geohash => {
        try {
          const keyRange = IDBKeyRange.only(geohash);
          const request = index.openCursor(keyRange);

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              if (cursor.value.isActive === true) {
                results.push(cursor.value);
              }
              cursor.continue();
            } else {
              processed++;
              if (processed >= total) {
                resolve(results);
              }
            }
          };

          request.onerror = () => {
            processed++;
            if (processed >= total) {
              resolve(results);
            }
          };
        } catch (error) {
          processed++;
          if (processed >= total) {
            resolve(results);
          }
        }
      });
    });

    return merchants.filter(merchant => {
      const distance = calculateDistance(centerLat, centerLng, merchant.lat, merchant.lng);
      return distance <= radiusKm;
    });
  }

  async getStats(): Promise<DatabaseStats> {
    await this.init();

    const [totalOrders, activeOrders, totalMerchants, activeMerchants] = await Promise.all([
      this.countAll('orders'),
      this.countByStatus('orders', 'pending'),
      this.countAll('merchants'),
      this.countActiveMerchants()
    ]);

    return {
      totalOrders,
      activeOrders,
      totalMerchants,
      activeMerchants
    };
  }

  private countAll(storeName: StoreType): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = this.getStore(transaction, storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private countByStatus(storeName: StoreType, status: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = this.getStore(transaction, storeName);
      const index = store.index('status');
      const request = index.count(IDBKeyRange.only(status));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private countActiveMerchants(): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction('merchants', 'readonly');
      const store = this.getStore(transaction, 'merchants');
      const request = store.openCursor();
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          if (cursor.value.isActive === true) {
            count++;
          }
          cursor.continue();
        } else {
          resolve(count);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(['orders', 'merchants'], 'readwrite');
      const orderStore = this.getStore(transaction, 'orders');
      const merchantStore = this.getStore(transaction, 'merchants');

      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed >= 2) resolve();
      };

      const orderRequest = orderStore.clear();
      orderRequest.onsuccess = checkComplete;
      orderRequest.onerror = () => reject(orderRequest.error);

      const merchantRequest = merchantStore.clear();
      merchantRequest.onsuccess = checkComplete;
      merchantRequest.onerror = () => reject(merchantRequest.error);
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

export const dbManager = new IndexedDBManager();
