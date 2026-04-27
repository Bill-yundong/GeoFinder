import { motion, AnimatePresence } from 'framer-motion';
import type { OrderWithDistance } from '../workers/distanceWorker';

interface OrderListProps {
  orders: OrderWithDistance[];
  selectedOrderId?: string;
  onOrderSelect: (order: OrderWithDistance) => void;
  maxVisible?: number;
  loading?: boolean;
}

const orderStatusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(255, 107, 107, 0.2)', text: '#ff6b6b', label: '待接单' },
  accepted: { bg: 'rgba(78, 205, 196, 0.2)', text: '#4ecdc4', label: '已接单' },
  completed: { bg: 'rgba(100, 150, 255, 0.2)', text: 'rgba(150, 180, 255, 0.8)', label: '已完成' },
  cancelled: { bg: 'rgba(150, 150, 150, 0.2)', text: 'rgba(150, 150, 150, 0.8)', label: '已取消' }
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
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

const LoadingSkeleton: React.FC = () => (
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
    {[1, 2, 3].map((i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
        style={{
          padding: '16px',
          marginBottom: '12px',
          background: 'rgba(30, 40, 80, 0.5)',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ width: '120px', height: '16px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '4px' }} />
          <div style={{ width: '60px', height: '16px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '4px' }} />
        </div>
        <div style={{ width: '180px', height: '14px', background: 'rgba(100, 150, 255, 0.1)', borderRadius: '4px' }} />
      </motion.div>
    ))}
  </motion.div>
);

const EmptyState: React.FC = () => (
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
      🛵
    </motion.div>
    <div style={{ color: 'rgba(150, 180, 255, 0.8)', fontSize: '16px', marginBottom: '8px' }}>
      附近暂无活跃订单
    </div>
    <div style={{ color: 'rgba(150, 180, 255, 0.5)', fontSize: '14px' }}>
      调整搜索半径或等待新订单
    </div>
  </motion.div>
);

export const OrderList: React.FC<OrderListProps> = ({
  orders,
  selectedOrderId,
  onOrderSelect,
  maxVisible = 10,
  loading = false
}) => {
  const visibleOrders = orders.slice(0, maxVisible);
  const hasMore = orders.length > maxVisible;

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (visibleOrders.length === 0) {
    return <EmptyState />;
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
          padding: '16px 20px',
          borderBottom: '1px solid rgba(100, 150, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ color: 'rgba(150, 180, 255, 0.9)', fontSize: '16px', fontWeight: 600 }}>
          附近订单
        </span>
        <motion.span
          key={orders.length}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{
            background: 'rgba(255, 107, 107, 0.2)',
            color: '#ff6b6b',
            padding: '2px 10px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          {orders.length} 个
        </motion.span>
      </div>

      <motion.div
        style={{ maxHeight: '400px', overflowY: 'auto' }}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <AnimatePresence mode="popLayout">
          {visibleOrders.map((order, index) => {
            const isSelected = order.id === selectedOrderId;
            const statusInfo = orderStatusColors[order.status] || orderStatusColors.pending;

            return (
              <motion.div
                key={order.id}
                layout
                variants={itemVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                whileHover={{
                  scale: 1.02,
                  background: isSelected
                    ? 'rgba(0, 212, 255, 0.15)'
                    : 'rgba(50, 70, 120, 0.3)'
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onOrderSelect(order)}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  background: isSelected
                    ? 'rgba(0, 212, 255, 0.1)'
                    : 'transparent',
                  borderBottom: index < visibleOrders.length - 1
                    ? '1px solid rgba(100, 150, 255, 0.1)'
                    : 'none',
                  borderLeft: isSelected
                    ? '3px solid #00d4ff'
                    : '3px solid transparent',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ flex: 1, marginRight: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          color: '#ffffff',
                          fontSize: '16px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '200px'
                        }}
                      >
                        {order.merchantName}
                      </span>
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: statusInfo.bg,
                          color: statusInfo.text,
                          fontSize: '12px',
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {statusInfo.label}
                      </motion.span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: 'rgba(150, 180, 255, 0.6)', fontSize: '13px' }}>
                        订单金额: ¥{order.orderAmount.toFixed(2)}
                      </span>
                      <span style={{ color: 'rgba(150, 180, 255, 0.6)', fontSize: '13px' }}>
                        预计送达: {order.estimatedDeliveryTime}分钟
                      </span>
                    </div>
                  </div>

                  <motion.div
                    animate={isSelected ? {
                      boxShadow: '0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(0, 212, 255, 0.2)'
                    } : {}}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '4px'
                    }}
                  >
                    <motion.span
                      key={order.distance}
                      initial={{ scale: 1.1, color: '#00d4ff' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: isSelected ? '#00d4ff' : '#ffffff'
                      }}
                    >
                      {order.distance.toFixed(2)}
                    </motion.span>
                    <span style={{ color: 'rgba(150, 180, 255, 0.6)', fontSize: '12px' }}>
                      公里
                    </span>
                  </motion.div>
                </div>

                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: '12px' }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          padding: '12px',
                          background: 'rgba(0, 212, 255, 0.05)',
                          borderRadius: '8px',
                          border: '1px solid rgba(0, 212, 255, 0.2)'
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <span style={{ color: 'rgba(150, 180, 255, 0.6)', fontSize: '12px' }}>订单 ID</span>
                            <div style={{ color: '#ffffff', fontSize: '14px', fontFamily: 'monospace' }}>
                              {order.id}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(150, 180, 255, 0.6)', fontSize: '12px' }}>商家 ID</span>
                            <div style={{ color: '#ffffff', fontSize: '14px', fontFamily: 'monospace' }}>
                              {order.merchantId}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(150, 180, 255, 0.6)', fontSize: '12px' }}>创建时间</span>
                            <div style={{ color: '#ffffff', fontSize: '14px' }}>
                              {new Date(order.createdAt).toLocaleString('zh-CN')}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(150, 180, 255, 0.6)', fontSize: '12px' }}>Geohash</span>
                            <div style={{ color: '#ffffff', fontSize: '14px', fontFamily: 'monospace' }}>
                              {order.geohash}
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
            padding: '12px 20px',
            textAlign: 'center',
            borderTop: '1px solid rgba(100, 150, 255, 0.1)',
            color: 'rgba(150, 180, 255, 0.5)',
            fontSize: '13px'
          }}
        >
          还有 {orders.length - maxVisible} 个订单未显示
        </motion.div>
      )}
    </motion.div>
  );
};

export const AnchorPoint: React.FC<{
  x: number;
  y: number;
  isActive: boolean;
  label?: string;
  onClick?: () => void;
}> = ({ x, y, isActive, label, onClick }) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        cursor: onClick ? 'pointer' : 'default',
        zIndex: 10
      }}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.9 } : {}}
    >
      <motion.div
        animate={isActive ? {
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8]
        } : {}}
        transition={isActive ? {
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        } : {}}
        style={{
          position: 'absolute',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: isActive
            ? 'rgba(0, 212, 255, 0.2)'
            : 'rgba(100, 150, 255, 0.1)',
          transform: 'translate(-50%, -50%)',
          left: '50%',
          top: '50%'
        }}
      />

      <motion.div
        animate={isActive ? {
          scale: 1.1
        } : {
          scale: 1
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 15
        }}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          background: isActive
            ? 'linear-gradient(135deg, #00d4ff, #6366f1)'
            : 'rgba(100, 150, 255, 0.5)',
          boxShadow: isActive
            ? '0 0 20px rgba(0, 212, 255, 0.6), 0 0 40px rgba(99, 102, 241, 0.3)'
            : 'none'
        }}
      />

      <AnimatePresence>
        {label && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px',
              padding: '4px 8px',
              background: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
