import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpatialRadarChart } from './components/SpatialRadarChart';
import { RadiusSelector, RadiusExpansionEffect } from './components/RadiusSelector';
import { OrderList } from './components/OrderList';
import { MerchantList } from './components/MerchantList';
import { dbManager } from './utils/indexedDB';
import { workerManager, type OrderWithDistance, type MerchantWithDistance } from './utils/workerManager';
import {
  OrderSimulator,
  type MerchantWithCategory,
  type MerchantStats,
  type SimulationEvent
} from './utils/dataGenerator';
import './App.css';

const CENTER_LAT = 39.9042;
const CENTER_LNG = 116.4074;
const MAX_RADIUS = 5;

interface Stats {
  totalOrders: number;
  activeOrders: number;
  totalMerchants: number;
  activeMerchants: number;
  queryTime?: number;
  sortTime?: number;
}

interface ActiveTab {
  key: 'orders' | 'merchants';
  label: string;
  icon: string;
}

const tabs: ActiveTab[] = [
  { key: 'orders', label: '订单列表', icon: '📦' },
  { key: 'merchants', label: '商家列表', icon: '🏪' }
];

function App() {
  const [radius, setRadius] = useState<number>(1);
  const [orders, setOrders] = useState<OrderWithDistance[]>([]);
  const [merchants, setMerchants] = useState<MerchantWithDistance[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDistance | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<
    (MerchantWithCategory & { distance: number }) | null
  >(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'merchants'>('orders');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    activeOrders: 0,
    totalMerchants: 0,
    activeMerchants: 0
  });
  const [merchantStats, setMerchantStats] = useState<MerchantStats | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [showExpansion, setShowExpansion] = useState<boolean>(false);

  const orderSimulatorRef = useRef<OrderSimulator | null>(null);
  const updateTimerRef = useRef<number | null>(null);

  const initializeData = useCallback(async () => {
    setLoading(true);
    try {
      await dbManager.init();
      await dbManager.clearAll();

      orderSimulatorRef.current = new OrderSimulator(
        CENTER_LAT,
        CENTER_LNG,
        MAX_RADIUS
      );

      orderSimulatorRef.current.setOnNewOrder(async (order, merchant) => {
        if (merchant) {
          await dbManager.addMerchant(merchant);
        }
        await dbManager.addOrder(order);
      });

      orderSimulatorRef.current.setOnEvent((event: SimulationEvent) => {
        if (event.type === 'merchant_created' || event.type === 'order_created') {
          const currentStats = orderSimulatorRef.current?.getStatsInRadius(
            CENTER_LAT,
            CENTER_LNG,
            MAX_RADIUS
          );
          if (currentStats) {
            setMerchantStats(currentStats);
          }
        }
      });

      setLoading(false);
    } catch (error) {
      console.error('初始化数据失败:', error);
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const startTime = performance.now();

      const rawOrders = await dbManager.queryOrdersInRadius(
        CENTER_LAT,
        CENTER_LNG,
        radius,
        'pending'
      );

      const rawMerchants = await dbManager.queryActiveMerchantsInRadius(
        CENTER_LAT,
        CENTER_LNG,
        radius
      );

      const dbStats = await dbManager.getStats();

      const queryTime = performance.now() - startTime;

      const { orders: sortedOrders, executionTime: sortTime } = await workerManager.calculateAndSortOrders(
        CENTER_LAT,
        CENTER_LNG,
        rawOrders
      );

      const { merchants: sortedMerchants } = await workerManager.calculateAndSortMerchants(
        CENTER_LAT,
        CENTER_LNG,
        rawMerchants
      );

      setOrders(sortedOrders);
      setMerchants(sortedMerchants);
      setStats({
        ...dbStats,
        queryTime,
        sortTime
      });
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  }, [radius]);

  useEffect(() => {
    initializeData();

    return () => {
      workerManager.terminate();
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
      if (orderSimulatorRef.current) {
        orderSimulatorRef.current.stop();
      }
    };
  }, [initializeData]);

  useEffect(() => {
    if (!loading) {
      refreshData();
    }
  }, [loading, refreshData]);

  useEffect(() => {
    if (!loading) {
      updateTimerRef.current = window.setInterval(refreshData, 2000);

      return () => {
        if (updateTimerRef.current) {
          clearInterval(updateTimerRef.current);
        }
      };
    }
  }, [loading, refreshData]);

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
    setShowExpansion(true);
    setTimeout(() => setShowExpansion(false), 2000);
  }, []);

  const toggleSimulation = useCallback(async () => {
    if (isSimulating) {
      orderSimulatorRef.current?.stop();
      setIsSimulating(false);
    } else {
      if (!orderSimulatorRef.current?.hasInitialized()) {
        const { merchants, orders } = orderSimulatorRef.current?.startWithBatch(
          100,
          2,
          8,
          2000
        ) || { merchants: [], orders: [] };

        await dbManager.addMerchants(merchants);
        await dbManager.addOrders(orders);

        const currentStats = orderSimulatorRef.current?.getStatsInRadius(
          CENTER_LAT,
          CENTER_LNG,
          MAX_RADIUS
        );
        if (currentStats) {
          setMerchantStats(currentStats);
        }
      } else {
        orderSimulatorRef.current?.start(2000);
      }

      setIsSimulating(true);
    }
  }, [isSimulating]);

  const handleOrderSelect = useCallback((order: OrderWithDistance) => {
    setSelectedOrder((prev: OrderWithDistance | null) => prev?.id === order.id ? null : order);
    setSelectedMerchant(null);
  }, []);

  const handleOrderClick = useCallback((order: OrderWithDistance) => {
    setSelectedOrder((prev: OrderWithDistance | null) => prev?.id === order.id ? null : order);
    setSelectedMerchant(null);
  }, []);

  const handleMerchantSelect = useCallback((
    merchant: MerchantWithCategory & { distance: number }
  ) => {
    setSelectedMerchant((prev) => prev?.id === merchant.id ? null : merchant);
    setSelectedOrder(null);
  }, []);

  return (
    <motion.div
      className="app"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <header className="app-header">
        <div className="header-left">
          <motion.div
            className="logo"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            🛵
          </motion.div>
          <div>
            <h1>GeoFinder</h1>
            <p>实时空间订单筛选系统</p>
          </div>
        </div>

        <div className="header-stats">
          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.05 }}
          >
            <span className="stat-value">{stats.activeOrders}</span>
            <span className="stat-label">活跃订单</span>
          </motion.div>
          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.05 }}
          >
            <span className="stat-value">{stats.activeMerchants}</span>
            <span className="stat-label">活跃商家</span>
          </motion.div>
          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.05 }}
          >
            <span className="stat-value">{stats.queryTime?.toFixed(1) || '-'}</span>
            <span className="stat-label">查询 (ms)</span>
          </motion.div>
          <motion.div
            className="stat-card"
            whileHover={{ scale: 1.05 }}
          >
            <span className="stat-value">{stats.sortTime?.toFixed(1) || '-'}</span>
            <span className="stat-label">排序 (ms)</span>
          </motion.div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-left">
          <motion.div
            className="control-panel"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <RadiusSelector
              maxRadius={MAX_RADIUS}
              currentRadius={radius}
              onRadiusChange={handleRadiusChange}
            />

            <motion.div
              className="simulation-controls"
              style={{
                marginTop: '16px',
                display: 'flex',
                gap: '12px'
              }}
            >
              <motion.button
                className={`control-button ${isSimulating ? 'active' : ''}`}
                onClick={toggleSimulation}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSimulating ? '⏸ 停止模拟' : '▶ 开始模拟'}
              </motion.button>

              <motion.button
                className="control-button"
                onClick={refreshData}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                🔄 刷新数据
              </motion.button>
            </motion.div>

            <motion.div
              className="info-panel"
              style={{
                marginTop: '16px',
                padding: '16px',
                background: 'rgba(10, 14, 39, 0.8)',
                borderRadius: '12px',
                border: '1px solid rgba(100, 150, 255, 0.2)',
                fontSize: '13px',
                color: 'rgba(150, 180, 255, 0.7)',
                lineHeight: '1.8'
              }}
            >
              <div><strong>📍 中心位置:</strong> {CENTER_LAT.toFixed(4)}, {CENTER_LNG.toFixed(4)}</div>
              <div><strong>📏 搜索半径:</strong> {radius} km</div>
              <div><strong>📊 当前筛选订单:</strong> {orders.length} 个</div>
              <div><strong>🏪 当前筛选商家:</strong> {merchants.length} 家</div>
              {merchantStats && (
                <>
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(100, 150, 255, 0.1)' }}>
                    <strong style={{ color: '#4ecdc4' }}>📊 5km 范围内商家统计:</strong>
                  </div>
                  <div><strong>总计商家:</strong> {merchantStats.totalMerchants} 家</div>
                  <div><strong>活跃商家:</strong> {merchantStats.activeMerchants} 家</div>
                  <div><strong>平均评分:</strong> ⭐ {merchantStats.avgRating}</div>
                  <div><strong>平均单量:</strong> 🍕 {merchantStats.avgOrderCount}</div>
                </>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            className="tab-container"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{
              background: 'rgba(10, 14, 39, 0.8)',
              borderRadius: '16px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(100, 150, 255, 0.2)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid rgba(100, 150, 255, 0.1)',
                padding: '4px'
              }}
            >
              {tabs.map((tab) => (
                <motion.button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedOrder(null);
                    setSelectedMerchant(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: activeTab === tab.key
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(0, 212, 255, 0.2))'
                      : 'transparent',
                    color: activeTab === tab.key
                      ? '#ffffff'
                      : 'rgba(150, 180, 255, 0.6)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </motion.button>
              ))}
            </div>

            <div style={{ padding: '12px' }}>
              <AnimatePresence mode="wait">
                {activeTab === 'orders' ? (
                  <motion.div
                    key="orders"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <OrderList
                      orders={orders}
                      selectedOrderId={selectedOrder?.id}
                      onOrderSelect={handleOrderSelect}
                      loading={loading}
                      maxVisible={15}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="merchants"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MerchantList
                      merchants={merchants.map(m => ({
                        ...m,
                        category: (m as any).category || '特色美食',
                        activeOrders: (m as any).activeOrders || 0,
                        distance: m.distance
                      }))}
                      selectedMerchantId={selectedMerchant?.id}
                      onMerchantSelect={handleMerchantSelect}
                      loading={loading}
                      maxVisible={15}
                      stats={merchantStats || undefined}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        <div className="main-right">
          <motion.div
            className="radar-container"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 100 }}
          >
            <div className="radar-wrapper" style={{ position: 'relative' }}>
              <AnimatePresence>
                {showExpansion && (
                  <RadiusExpansionEffect
                    isActive={showExpansion}
                    centerX={50}
                    centerY={50}
                    maxRadius={300}
                    duration={2}
                  />
                )}
              </AnimatePresence>

              <SpatialRadarChart
                centerLat={CENTER_LAT}
                centerLng={CENTER_LNG}
                radiusKm={radius}
                orders={orders}
                merchants={merchants}
                selectedOrderId={selectedOrder?.id}
                onOrderClick={handleOrderClick}
                width={550}
                height={550}
              />
            </div>

            <div className="radar-info" style={{ marginTop: '20px', textAlign: 'center' }}>
              <AnimatePresence mode="wait">
                {selectedOrder ? (
                  <motion.div
                    key="selected"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="selected-order-info"
                    style={{
                      padding: '16px 24px',
                      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(99, 102, 241, 0.1))',
                      borderRadius: '12px',
                      border: '1px solid rgba(0, 212, 255, 0.3)'
                    }}
                  >
                    <div style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                      {selectedOrder.merchantName}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '14px' }}>
                      <span style={{ color: '#00d4ff' }}>
                        📏 {selectedOrder.distance.toFixed(2)} km
                      </span>
                      <span style={{ color: '#ff6b6b' }}>
                        💰 ¥{selectedOrder.orderAmount}
                      </span>
                      <span style={{ color: '#4ecdc4' }}>
                        ⏱️ {selectedOrder.estimatedDeliveryTime}分钟
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      color: 'rgba(150, 180, 255, 0.6)',
                      fontSize: '14px'
                    }}
                  >
                    点击地图上的订单或从列表中选择查看详情
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>

      <AnimatePresence>
        {loading && (
          <motion.div
            className="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="loading-content">
              <motion.div
                className="loading-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <p>正在初始化数据...</p>
              <p className="loading-subtitle">生成 100+ 商家和 500+ 订单</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default App;
