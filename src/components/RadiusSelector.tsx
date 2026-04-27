import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RadiusSelectorProps {
  maxRadius: number;
  currentRadius: number;
  onRadiusChange: (radius: number) => void;
  unit?: string;
}

export const RadiusSelector: React.FC<RadiusSelectorProps> = ({
  maxRadius,
  currentRadius,
  onRadiusChange,
  unit = 'km'
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const percentage = (currentRadius / maxRadius) * 100;

  const handleDrag = (event: MouseEvent | TouchEvent, info: { point: { x: number } }) => {
    const rect = (event.target as HTMLElement).closest('.radius-selector-container')?.getBoundingClientRect();
    if (!rect) return;

    const clientX = 'touches' in event ? event.touches[0].clientX : info.point.x;
    const relativeX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newRadius = Math.max(0.1, Math.min(maxRadius, relativeX * maxRadius));
    onRadiusChange(Math.round(newRadius * 10) / 10);
  };

  return (
    <div
      className="radius-selector-container"
      style={{
        padding: '20px',
        background: 'rgba(10, 14, 39, 0.8)',
        borderRadius: '16px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(100, 150, 255, 0.2)'
      }}
    >
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'rgba(150, 180, 255, 0.8)', fontSize: '14px' }}>搜索半径</span>
        <motion.div
          key={currentRadius}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{
            background: 'linear-gradient(135deg, #00d4ff, #6366f1)',
            padding: '4px 12px',
            borderRadius: '20px',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 600
          }}
        >
          {currentRadius} {unit}
        </motion.div>
      </div>

      <div
        style={{
          position: 'relative',
          height: '40px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <motion.div
          style={{
            position: 'absolute',
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            background: 'rgba(50, 70, 120, 0.5)',
            overflow: 'hidden'
          }}
        >
          <motion.div
            style={{
              height: '100%',
              borderRadius: '3px',
              background: 'linear-gradient(90deg, #00d4ff, #6366f1)',
              width: `${percentage}%`
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </motion.div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          style={{
            position: 'absolute',
            left: `calc(${percentage}% - 14px)`,
            zIndex: 10,
            cursor: 'grab'
          }}
          whileTap={{ cursor: 'grabbing' }}
        >
          <motion.div
            animate={isDragging ? { scale: 1.3 } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d4ff, #6366f1)',
              boxShadow: isDragging
                ? '0 0 30px rgba(0, 212, 255, 0.6), 0 0 60px rgba(99, 102, 241, 0.4)'
                : '0 4px 15px rgba(0, 212, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ffffff'
              }}
            />
          </motion.div>

          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  border: '2px solid rgba(0, 212, 255, 0.5)',
                  pointerEvents: 'none'
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {[0.25, 0.5, 0.75].map((ratio, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${ratio * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '2px',
              height: '12px',
              background: 'rgba(100, 150, 255, 0.3)',
              borderRadius: '1px'
            }}
          />
        ))}
      </div>

      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'rgba(150, 180, 255, 0.6)'
        }}
      >
        <span>0.1 {unit}</span>
        <span>{(maxRadius * 0.5).toFixed(1)} {unit}</span>
        <span>{maxRadius} {unit}</span>
      </div>
    </div>
  );
};

export const RadiusExpansionEffect: React.FC<{
  isActive: boolean;
  centerX?: number;
  centerY?: number;
  maxRadius?: number;
  duration?: number;
}> = ({
  isActive,
  centerX = 50,
  centerY = 50,
  maxRadius = 200,
  duration = 2
}) => {
  const [ripples, setRipples] = useState<number[]>([]);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setRipples(prev => [...prev, Date.now()]);
      }, 500);

      return () => clearInterval(interval);
    } else {
      setRipples([]);
    }
  }, [isActive]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      <AnimatePresence>
        {ripples.map((timestamp) => (
          <motion.div
            key={timestamp}
            initial={{
              scale: 0,
              opacity: 0.8
            }}
            animate={{
              scale: maxRadius / 50,
              opacity: 0
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: duration,
              ease: 'easeOut'
            }}
            style={{
              position: 'absolute',
              left: `${centerX}%`,
              top: `${centerY}%`,
              width: '100px',
              height: '100px',
              marginLeft: '-50px',
              marginTop: '-50px',
              borderRadius: '50%',
              border: '2px solid rgba(0, 212, 255, 0.6)',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.3), inset 0 0 20px rgba(0, 212, 255, 0.1)'
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
