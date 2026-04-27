import { motion, AnimatePresence } from 'framer-motion';
import type { MerchantWithCategory, MerchantStats } from '../utils/dataGenerator';

interface MerchantListProps {
  merchants: (MerchantWithCategory & { distance: number })[];
  selectedMerchantId?: string;
  onMerchantSelect?: (merchant: MerchantWithCategory & { distance: number }) => void;
  maxVisible?: number;
  loading?: boolean;
  stats?: MerchantStats;
}

const categoryEmojis: Record<string, string> = {
  '快餐': '🍔',
  '咖啡饮品': '☕',
  '火锅': '🍲',
  '中餐': '🍜',
  '小吃快餐': '🌭',
  '特色美食': '🍱'
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  '快餐': { bg: 'rgba(255, 107, 107, 0.2)', text: '#ff6b6b' },
  '咖啡饮品': { bg: 'rgba(78, 205, 196, 0.2)', text: '#4ecdc4' },
  '火锅': { bg: 'rgba(255, 159, 67, 0.2)', text: '#ff9f43' },
  '中餐': { bg: 'rgba(108, 92, 231, 0.2)', text: '#6c5ce7' },
  '小吃快餐': { bg: 'rgba(0, 210, 211, 0.2)', text: '#00d2d3' },
  '特色美食': { bg: 'rgba(255, 121, 198, 0.2)', text: '#ff79c6' }
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1
  },
  exit: {
    opacity: 0,
    x: 20,
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
};

const MerchantLoadingSkeleton: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    style={{
      padding: '20px',
      background: 'rgba(10, 14, 39, 0.8)',
      borderRadius: '16px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(100, 150, 255, 0.2)'
    }}
  >
    {[1, 2, 3, 4, 5].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
        style={{
          padding: '14px',
          marginBottom: '10px',
          background: 'rgba(30, 40, 80, 0.5)',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '8px' }} />
            <div style={{ width: '100px', height: '16px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '4px' }} />
          </div>
          <div style={{ width: '50px', height: '18px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', gap: '16px', marginLeft: '40px' }}>
          <div style={{ width: '60px', height: '12px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '4px' }} />
          <div style={{ width: '80px', height: '12px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '4px' }} />
        </div>
      </motion.div>
    ))}
  </motion.div>
);

const MerchantEmptyState: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    style={{
      padding: '40px 20px',
      textAlign: 'center',
      background: 'rgba(10, 14, 39, 0.8)',
      borderRadius: '16px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(100, 150, 255, 0.2)'
    }}
  >
    <motion.div
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: '48px', marginBottom: '16px' }}
    >
      🏪
    </motion.div>
    <div style={{ color: 'rgba(150, 180, 255, 0.8)', fontSize: '16px', marginBottom: '8px' }}>
      附近暂无活跃商家
    </div>
    <div style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '14px' }}>
      点击"开始模拟"生成测试商家
    </div>
  </motion.div>
);

const StatsPanel: React.FC<{ stats: MerchantStats }> = ({ stats }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      padding: '12px 16px',
      background: 'rgba(0, 212, 255, 0.05)',
      borderBottom: '1px solid rgba(100, 150, 255, 0.1)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: '12px'
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 700 }}>
        {stats.totalMerchants}
      </div>
      <div style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>
        总计
      </div>
    </div>
    <div style={{ textAlign: 'center' }}>
      <motion.div
        animate={stats.activeMerchants > 0 ? {
          color: ['#4ecdc4', '#ffffff', '#4ecdc4']
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ color: '#4ecdc4', fontSize: '18px', fontWeight: 700 }}
      >
        {stats.activeMerchants}
      </motion.div>
      <div style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>
        活跃
      </div>
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#ff9f43', fontSize: '18px', fontWeight: 700 }}>
        ⭐ {stats.avgRating}
      </div>
      <div style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>
        平均评分
      </div>
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#ff79c6', fontSize: '18px', fontWeight: 700 }}>
        🍕 {stats.avgOrderCount}
      </div>
      <div style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>
        单量
      </div>
    </div>
  </motion.div>
);

export const MerchantList: React.FC<MerchantListProps> = ({
  merchants,
  selectedMerchantId,
  onMerchantSelect,
  maxVisible = 15,
  loading = false,
  stats
}) => {
  const visibleMerchants = merchants.slice(0, maxVisible);
  const hasMore = merchants.length > maxVisible;

  if (loading) {
    return <MerchantLoadingSkeleton />;
  }

  if (visibleMerchants.length === 0) {
    return <MerchantEmptyState />;
  }

  return (
    <motion.div
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
          padding: '14px 16px',
          borderBottom: '1px solid rgba(100, 150, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(78, 205, 196, 0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🏪</span>
          <span style={{ color: 'rgba(150, 180, 255, 0.9)', fontSize: '15px', fontWeight: 600 }}>
            活跃商家
          </span>
        </div>
        <motion.span
          key={merchants.length}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{
            background: 'rgba(78, 205, 196, 0.2)',
            color: '#4ecdc4',
            padding: '2px 10px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {merchants.length} 家
        </motion.span>
      </div>

      {stats && <StatsPanel stats={stats} />}

      <motion.div
        style={{ maxHeight: '350px', overflowY: 'auto' }}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence mode="popLayout">
          {visibleMerchants.map((merchant, index) => {
            const isSelected = merchant.id === selectedMerchantId;
            const categoryColor = categoryColors[merchant.category] || categoryColors['特色美食'];
            const emoji = categoryEmojis[merchant.category] || '🍴';

            return (
              <motion.div
                key={merchant.id}
                layout
                variants={itemVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                whileHover={{
                  scale: 1.01,
                  background: isSelected
                    ? 'rgba(78, 205, 196, 0.15)'
                    : 'rgba(50, 70, 120, 0.3)'
                }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onMerchantSelect?.(merchant)}
                style={{
                  padding: '12px 16px',
                  cursor: onMerchantSelect ? 'pointer' : 'default',
                  background: isSelected
                    ? 'rgba(78, 205, 196, 0.1)'
                    : 'transparent',
                  borderBottom: index < visibleMerchants.length - 1
                    ? '1px solid rgba(100, 150, 255, 0.08)'
                    : 'none',
                  borderLeft: isSelected
                    ? '3px solid #4ecdc4'
                    : '3px solid transparent',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: categoryColor.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}
                      >
                        {emoji}
                      </motion.div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              color: '#ffffff',
                              fontSize: '14px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '180px'
                            }}
                          >
                            {merchant.name}
                          </span>
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: categoryColor.bg,
                              color: categoryColor.text,
                              fontSize: '11px',
                              fontWeight: 500,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {merchant.category}
                          </motion.span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                          <span style={{ color: '#ff9f43', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            ⭐ {merchant.rating}
                          </span>
                          <span style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '12px' }}>
                            🍕 {merchant.orderCount} 单
                          </span>
                          {merchant.activeOrders && (
                            <motion.span
                              animate={{
                                opacity: [1, 0.6, 1]
                              }}
                              transition={{
                                duration: 1.5,
                                repeat: Infinity
                              }}
                              style={{
                                color: '#ff6b6b',
                                fontSize: '12px',
                                fontWeight: 500
                              }}
                            >
                              🔥 {merchant.activeOrders} 单待接
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    animate={isSelected ? {
                      boxShadow: '0 0 20px rgba(78, 205, 196, 0.5), 0 0 40px rgba(78, 205, 196, 0.2)'
                    } : {}}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '2px'
                    }}
                  >
                    <motion.span
                      key={merchant.distance}
                      initial={{ scale: 1.1, color: '#4ecdc4' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: isSelected ? '#4ecdc4' : '#ffffff'
                      }}
                    >
                      {merchant.distance.toFixed(2)}
                    </motion.span>
                    <span style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>
                      公里
                    </span>
                  </motion.div>
                </div>

                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: '10px' }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          padding: '10px 12px',
                          marginLeft: '44px',
                          background: 'rgba(78, 205, 196, 0.05)',
                          borderRadius: '8px',
                          border: '1px solid rgba(78, 205, 196, 0.2)'
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                          <div>
                            <span style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>商家 ID</span>
                            <div style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
                              {merchant.id.substring(0, 8)}...
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>纬度</span>
                            <div style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
                              {merchant.lat.toFixed(4)}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '11px' }}>经度</span>
                            <div style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
                              {merchant.lng.toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {hasMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: '10px 16px',
            textAlign: 'center',
            borderTop: '1px solid rgba(100, 150, 255, 0.1)',
            color: 'rgba(150, 180, 255, 0.4)',
            fontSize: '12px'
          }}
        >
          还有 {merchants.length - maxVisible} 家商家未显示
        </motion.div>
      )}
    </motion.div>
  );
};
