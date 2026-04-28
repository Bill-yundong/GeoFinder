import type { Order, Merchant } from './indexedDB';
import { calculateDistance } from './geohash';

const merchantCategories: Record<string, string[]> = {
  '快餐': ['麦当劳', '肯德基', '必胜客', '德克士', '华莱士', '汉堡王', '赛百味', '达美乐披萨', '棒约翰'],
  '咖啡饮品': ['星巴克', '瑞幸咖啡', '喜茶', '奈雪的茶', '一点点', 'CoCo都可', '蜜雪冰城', 'DQ冰雪皇后'],
  '火锅': ['海底捞', '小肥羊', '呷哺呷哺', '谭鸭血老火锅', '小龙坎', '蜀大侠'],
  '中餐': ['西贝莜面村', '外婆家', '绿茶餐厅', '太二酸菜鱼', '大董', '全聚德'],
  '小吃快餐': ['真功夫', '永和大王', '狗不理', '庆丰包子铺', '沙县小吃', '兰州拉面', '重庆小面'],
  '特色美食': ['桂林米粉', '云南过桥米线', '黄焖鸡米饭', '杨国福麻辣烫', '张亮麻辣烫', '冒菜', '麻辣香锅', '小龙虾']
};

const merchantPrefixes = [
  '精品', '特色', '正宗', '老字号', '网红',
  '人气', '火爆', '热门', '精选', '优选',
  '新鲜', '健康', '美味', '超值', '实惠'
];

export interface MerchantWithCategory extends Omit<Merchant, 'geohash'> {
  category: string;
  geohash?: string;
  distance?: number;
  activeOrders?: number;
}

export interface MerchantStats {
  totalMerchants: number;
  activeMerchants: number;
  byCategory: Record<string, number>;
  avgRating: number;
  avgOrderCount: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function generateMerchant(
  centerLat: number,
  centerLng: number,
  maxRadiusKm: number,
  category?: string
): Omit<MerchantWithCategory, 'geohash'> {
  const radius = Math.random() * maxRadiusKm;
  const angle = Math.random() * 2 * Math.PI;

  const latOffset = (radius / 111.32) * Math.sin(angle);
  const lngOffset = (radius / (111.32 * Math.cos(centerLat * Math.PI / 180))) * Math.cos(angle);

  const selectedCategory = category || getRandomItem(Object.keys(merchantCategories));
  const categoryNames = merchantCategories[selectedCategory];
  const baseName = getRandomItem(categoryNames);
  const prefix = Math.random() > 0.5 ? getRandomItem(merchantPrefixes) : '';
  const name = prefix + baseName;

  const isActive = Math.random() > 0.3;
  
  return {
    id: generateId(),
    name,
    category: selectedCategory,
    lat: centerLat + latOffset,
    lng: centerLng + lngOffset,
    rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
    orderCount: Math.floor(getRandomInRange(10, 500)),
    isActive,
    activeOrders: isActive ? Math.floor(getRandomInRange(1, 10)) : 0
  };
}

export function generateMerchantBatch(
  centerLat: number,
  centerLng: number,
  maxRadiusKm: number,
  count: number
): MerchantWithCategory[] {
  const merchants: MerchantWithCategory[] = [];
  const categories = Object.keys(merchantCategories);

  const distribution: Record<string, number> = {
    '快餐': 0.25,
    '咖啡饮品': 0.2,
    '小吃快餐': 0.2,
    '特色美食': 0.15,
    '中餐': 0.12,
    '火锅': 0.08
  };

  let assignedCount = 0;
  categories.forEach((category, index) => {
    const categoryCount = index === categories.length - 1
      ? count - assignedCount
      : Math.floor(count * distribution[category]);

    for (let i = 0; i < categoryCount; i++) {
      merchants.push(generateMerchant(centerLat, centerLng, maxRadiusKm, category) as MerchantWithCategory);
    }
    assignedCount += categoryCount;
  });

  return merchants.sort(() => Math.random() - 0.5);
}

export function getMerchantStats(merchants: MerchantWithCategory[]): MerchantStats {
  const byCategory: Record<string, number> = {};
  let totalRating = 0;
  let totalOrderCount = 0;
  let activeCount = 0;

  merchants.forEach(merchant => {
    byCategory[merchant.category] = (byCategory[merchant.category] || 0) + 1;
    totalRating += merchant.rating;
    totalOrderCount += merchant.orderCount;
    if (merchant.isActive) activeCount++;
  });

  return {
    totalMerchants: merchants.length,
    activeMerchants: activeCount,
    byCategory,
    avgRating: merchants.length > 0 ? parseFloat((totalRating / merchants.length).toFixed(1)) : 0,
    avgOrderCount: merchants.length > 0 ? Math.floor(totalOrderCount / merchants.length) : 0
  };
}

export function generateOrder(
  merchant: { id: string; name: string; lat: number; lng: number },
  status: Order['status'] = 'pending'
): Omit<Order, 'geohash'> {
  const now = Date.now();
  const createdAt = now - Math.floor(getRandomInRange(0, 30 * 60 * 1000));

  return {
    id: generateId(),
    merchantId: merchant.id,
    merchantName: merchant.name,
    lat: merchant.lat,
    lng: merchant.lng,
    status,
    createdAt,
    updatedAt: createdAt,
    orderAmount: parseFloat((15 + Math.random() * 85).toFixed(2)),
    estimatedDeliveryTime: Math.floor(getRandomInRange(15, 45))
  };
}

export function generateTestData(
  centerLat: number,
  centerLng: number,
  maxRadiusKm: number,
  merchantCount: number,
  ordersPerMerchantMin: number = 1,
  ordersPerMerchantMax: number = 5
): {
  merchants: Omit<Merchant, 'geohash'>[];
  orders: Omit<Order, 'geohash'>[];
} {
  const merchants: Omit<Merchant, 'geohash'>[] = [];
  const orders: Omit<Order, 'geohash'>[] = [];

  const activeMerchantCount = Math.floor(merchantCount * 0.7);
  const inactiveMerchantCount = merchantCount - activeMerchantCount;

  for (let i = 0; i < activeMerchantCount; i++) {
    const merchant = generateMerchant(centerLat, centerLng, maxRadiusKm);
    merchant.isActive = true;
    merchants.push(merchant);

    const orderCount = Math.floor(getRandomInRange(ordersPerMerchantMin, ordersPerMerchantMax + 1));
    for (let j = 0; j < orderCount; j++) {
      const statuses: Order['status'][] = ['pending', 'accepted'];
      const status = Math.random() > 0.3 ? 'pending' : getRandomItem(statuses);
      orders.push(generateOrder(merchant, status));
    }
  }

  for (let i = 0; i < inactiveMerchantCount; i++) {
    const merchant = generateMerchant(centerLat, centerLng, maxRadiusKm);
    merchant.isActive = false;
    merchants.push(merchant);

    if (Math.random() > 0.5) {
      orders.push(generateOrder(merchant, 'completed'));
    }
  }

  return { merchants, orders };
}

export function generateNewOrder(
  centerLat: number,
  centerLng: number,
  maxRadiusKm: number,
  existingMerchants?: MerchantWithCategory[]
): {
  merchant: Omit<MerchantWithCategory, 'geohash'> | null;
  order: Omit<Order, 'geohash'>;
} {
  let merchant: MerchantWithCategory | null = null;

  if (existingMerchants && existingMerchants.length > 0 && Math.random() > 0.3) {
    const activeMerchants = existingMerchants.filter(m => m.isActive);
    if (activeMerchants.length > 0) {
      merchant = getRandomItem(activeMerchants);
    }
  }

  if (!merchant) {
    const newMerchant = generateMerchant(centerLat, centerLng, maxRadiusKm);
    return {
      merchant: newMerchant,
      order: generateOrder(newMerchant, 'pending')
    };
  }

  return {
    merchant: null,
    order: generateOrder(merchant, 'pending')
  };
}

export interface SimulationConfig {
  centerLat: number;
  centerLng: number;
  maxRadiusKm: number;
  merchantCount: number;
  ordersPerMerchantMin: number;
  ordersPerMerchantMax: number;
  intervalMs: number;
}

export interface SimulationEvent {
  type: 'merchant_created' | 'order_created' | 'merchant_batch_created';
  merchant?: MerchantWithCategory;
  order?: Omit<Order, 'geohash'>;
  merchants?: MerchantWithCategory[];
  orders?: Omit<Order, 'geohash'>[];
  timestamp: number;
}

export class OrderSimulator {
  private centerLat: number;
  private centerLng: number;
  private maxRadiusKm: number;
  private merchants: MerchantWithCategory[];
  private intervalId: number | null = null;
  private onNewOrder: ((order: Omit<Order, 'geohash'>, merchant?: Omit<Merchant, 'geohash'>) => void) | null = null;
  private onEvent: ((event: SimulationEvent) => void) | null = null;
  private isInitialized: boolean = false;

  constructor(
    centerLat: number,
    centerLng: number,
    maxRadiusKm: number,
    merchants: MerchantWithCategory[] = []
  ) {
    this.centerLat = centerLat;
    this.centerLng = centerLng;
    this.maxRadiusKm = maxRadiusKm;
    this.merchants = merchants;
  }

  setMerchants(merchants: MerchantWithCategory[]): void {
    this.merchants = merchants;
  }

  getMerchants(): MerchantWithCategory[] {
    return this.merchants;
  }

  getActiveMerchants(): MerchantWithCategory[] {
    return this.merchants.filter(m => m.isActive);
  }

  setOnNewOrder(callback: (order: Omit<Order, 'geohash'>, merchant?: Omit<Merchant, 'geohash'>) => void): void {
    this.onNewOrder = callback;
  }

  setOnEvent(callback: (event: SimulationEvent) => void): void {
    this.onEvent = callback;
  }

  generateMerchantBatch(
    merchantCount: number = 100,
    ordersPerMerchantMin: number = 2,
    ordersPerMerchantMax: number = 8
  ): {
    merchants: MerchantWithCategory[];
    orders: Omit<Order, 'geohash'>[];
  } {
    const merchants = generateMerchantBatch(
      this.centerLat,
      this.centerLng,
      this.maxRadiusKm,
      merchantCount
    );

    const orders: Omit<Order, 'geohash'>[] = [];

    merchants.forEach(merchant => {
      const orderCount = Math.floor(
        getRandomInRange(ordersPerMerchantMin, ordersPerMerchantMax + 1)
      );

      for (let i = 0; i < orderCount; i++) {
        const statuses: Order['status'][] = ['pending', 'accepted'];
        const status = Math.random() > 0.3 ? 'pending' : getRandomItem(statuses);
        orders.push(generateOrder(merchant, status));
      }
    });

    this.merchants = [...this.merchants, ...merchants];
    this.isInitialized = true;

    this.onEvent?.({
      type: 'merchant_batch_created',
      merchants,
      orders,
      timestamp: Date.now()
    });

    return { merchants, orders };
  }

  generateSingleMerchant(): MerchantWithCategory {
    const merchant = generateMerchant(
      this.centerLat,
      this.centerLng,
      this.maxRadiusKm
    );

    this.merchants.push(merchant);

    this.onEvent?.({
      type: 'merchant_created',
      merchant,
      timestamp: Date.now()
    });

    return merchant;
  }

  start(intervalMs: number = 3000): void {
    if (this.intervalId !== null) {
      return;
    }

    this.intervalId = window.setInterval(() => {
      if (Math.random() > 0.2) {
        const { merchant, order } = generateNewOrder(
          this.centerLat,
          this.centerLng,
          this.maxRadiusKm,
          this.merchants
        );

        if (merchant) {
          this.merchants.push(merchant as MerchantWithCategory);

          this.onEvent?.({
            type: 'merchant_created',
            merchant: merchant as MerchantWithCategory,
            timestamp: Date.now()
          });
        }

        this.onEvent?.({
          type: 'order_created',
          merchant: merchant ? merchant as MerchantWithCategory : undefined,
          order,
          timestamp: Date.now()
        });

        this.onNewOrder?.(order, merchant || undefined);
      }
    }, intervalMs);
  }

  startWithBatch(
    merchantCount: number = 100,
    ordersPerMerchantMin: number = 2,
    ordersPerMerchantMax: number = 8,
    intervalMs: number = 3000
  ): {
    merchants: MerchantWithCategory[];
    orders: Omit<Order, 'geohash'>[];
  } {
    const result = this.generateMerchantBatch(
      merchantCount,
      ordersPerMerchantMin,
      ordersPerMerchantMax
    );

    this.start(intervalMs);

    return result;
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  hasInitialized(): boolean {
    return this.isInitialized;
  }

  getStats(): MerchantStats {
    return getMerchantStats(this.merchants);
  }

  getStatsInRadius(centerLat: number, centerLng: number, radiusKm: number): MerchantStats {
    const merchantsInRadius = this.merchants.filter(merchant => {
      const distance = calculateDistance(centerLat, centerLng, merchant.lat, merchant.lng);
      return distance <= radiusKm;
    });
    return getMerchantStats(merchantsInRadius);
  }

  getMerchantsByDistance(centerLat: number, centerLng: number): (MerchantWithCategory & { distance: number })[] {
    return this.merchants
      .map(merchant => ({
        ...merchant,
        distance: calculateDistance(centerLat, centerLng, merchant.lat, merchant.lng)
      }))
      .sort((a, b) => a.distance - b.distance);
  }

  clear(): void {
    this.merchants = [];
    this.isInitialized = false;
    this.stop();
  }
}
