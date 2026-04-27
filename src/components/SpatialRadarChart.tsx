import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { OrderWithDistance, MerchantWithDistance } from '../workers/distanceWorker';
import { calculateDistance } from '../utils/geohash';

interface SpatialRadarChartProps {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  orders?: OrderWithDistance[];
  merchants?: MerchantWithDistance[];
  selectedOrderId?: string;
  onOrderClick?: (order: OrderWithDistance) => void;
  onMerchantClick?: (merchant: MerchantWithDistance) => void;
  width?: number;
  height?: number;
}

interface Point {
  x: number;
  y: number;
}

interface ColorScheme {
  background: string;
  gridLine: string;
  centerPoint: string;
  order: string;
  orderSelected: string;
  merchant: string;
  merchantActive: string;
  distanceRing: string;
  distanceText: string;
}

const DEFAULT_COLORS: ColorScheme = {
  background: '#0a0e27',
  gridLine: 'rgba(100, 150, 255, 0.15)',
  centerPoint: '#00d4ff',
  order: '#ff6b6b',
  orderSelected: '#ffd93d',
  merchant: '#4ecdc4',
  merchantActive: '#67e8f9',
  distanceRing: 'rgba(100, 150, 255, 0.3)',
  distanceText: 'rgba(150, 180, 255, 0.8)'
};

function latLngToCanvasPoint(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  maxRadiusKm: number,
  canvasWidth: number,
  canvasHeight: number
): Point {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const maxRadiusPixels = Math.min(canvasWidth, canvasHeight) / 2 - 40;

  const scaleX = 111.32 * Math.cos(centerLat * Math.PI / 180);
  const scaleY = 111.32;

  const dxKm = (lng - centerLng) * scaleX;
  const dyKm = (centerLat - lat) * scaleY;

  const scale = maxRadiusPixels / maxRadiusKm;

  return {
    x: centerX + dxKm * scale,
    y: centerY + dyKm * scale
  };
}

function drawRadarBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxRadiusKm: number,
  colors: ColorScheme
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadiusPixels = Math.min(width, height) / 2 - 40;

  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, maxRadiusPixels
  );
  gradient.addColorStop(0, 'rgba(15, 25, 60, 0.9)');
  gradient.addColorStop(0.5, 'rgba(10, 15, 40, 0.9)');
  gradient.addColorStop(1, 'rgba(5, 10, 30, 0.9)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, maxRadiusPixels + 20, 0, Math.PI * 2);
  ctx.fill();

  const ringCount = 5;
  for (let i = 1; i <= ringCount; i++) {
    const radius = (maxRadiusPixels * i) / ringCount;
    const distanceKm = (maxRadiusKm * i) / ringCount;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = colors.distanceRing;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = colors.distanceText;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${distanceKm.toFixed(1)}km`,
      centerX + radius + 25,
      centerY
    );
  }

  const gridLines = 8;
  for (let i = 0; i < gridLines; i++) {
    const angle = (Math.PI * 2 * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(angle) * maxRadiusPixels,
      centerY + Math.sin(angle) * maxRadiusPixels
    );
    ctx.strokeStyle = colors.gridLine;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
  const centerGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, 8
  );
  centerGradient.addColorStop(0, '#ffffff');
  centerGradient.addColorStop(0.5, colors.centerPoint);
  centerGradient.addColorStop(1, 'rgba(0, 212, 255, 0)');
  ctx.fillStyle = centerGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawOrders(
  ctx: CanvasRenderingContext2D,
  orders: OrderWithDistance[],
  centerLat: number,
  centerLng: number,
  maxRadiusKm: number,
  canvasWidth: number,
  canvasHeight: number,
  selectedOrderId?: string,
  colors: ColorScheme = DEFAULT_COLORS
): Map<string, { x: number; y: number; order: OrderWithDistance }> {
  const orderMap = new Map<string, { x: number; y: number; order: OrderWithDistance }>();

  orders.forEach(order => {
    const point = latLngToCanvasPoint(
      order.lat, order.lng,
      centerLat, centerLng,
      maxRadiusKm, canvasWidth, canvasHeight
    );

    const isSelected = order.id === selectedOrderId;
    const isActive = order.status === 'pending';

    orderMap.set(order.id, { x: point.x, y: point.y, order });

    ctx.save();

    if (isActive) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = isSelected ? colors.orderSelected : colors.order;
    }

    const radius = isSelected ? 8 : (isActive ? 5 : 4);

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 217, 61, 0.3)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);

    if (isSelected) {
      ctx.fillStyle = colors.orderSelected;
    } else if (isActive) {
      ctx.fillStyle = colors.order;
    } else {
      ctx.fillStyle = 'rgba(255, 107, 107, 0.4)';
    }

    ctx.fill();

    if (isActive) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  });

  return orderMap;
}

function drawMerchants(
  ctx: CanvasRenderingContext2D,
  merchants: MerchantWithDistance[],
  centerLat: number,
  centerLng: number,
  maxRadiusKm: number,
  canvasWidth: number,
  canvasHeight: number,
  colors: ColorScheme = DEFAULT_COLORS
): Map<string, { x: number; y: number; merchant: MerchantWithDistance }> {
  const merchantMap = new Map<string, { x: number; y: number; merchant: MerchantWithDistance }>();

  merchants.forEach(merchant => {
    const point = latLngToCanvasPoint(
      merchant.lat, merchant.lng,
      centerLat, centerLng,
      maxRadiusKm, canvasWidth, canvasHeight
    );

    merchantMap.set(merchant.id, { x: point.x, y: point.y, merchant });

    ctx.save();

    if (merchant.isActive) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = colors.merchantActive;
    }

    const size = merchant.isActive ? 10 : 6;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y - size);
    ctx.lineTo(point.x + size, point.y + size / 2);
    ctx.lineTo(point.x - size, point.y + size / 2);
    ctx.closePath();

    ctx.fillStyle = merchant.isActive ? colors.merchantActive : colors.merchant;
    ctx.fill();

    if (merchant.isActive) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  });

  return merchantMap;
}

function drawTooltip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  isRight: boolean = true
): void {
  const padding = 8;
  const fontSize = 12;
  ctx.font = `${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + padding * 2;
  const boxHeight = fontSize + padding * 2;

  const boxX = isRight ? x + 15 : x - boxWidth - 15;
  const boxY = y - boxHeight / 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, boxX + padding, boxY + boxHeight / 2);
}

export const SpatialRadarChart: React.FC<SpatialRadarChartProps> = ({
  centerLat,
  centerLng,
  radiusKm,
  orders = [],
  merchants = [],
  selectedOrderId,
  onOrderClick,
  onMerchantClick,
  width = 600,
  height = 600
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredItem, setHoveredItem] = useState<{ type: 'order' | 'merchant'; id: string } | null>(null);
  const orderMapRef = useRef<Map<string, { x: number; y: number; order: OrderWithDistance }>>(new Map());
  const merchantMapRef = useRef<Map<string, { x: number; y: number; merchant: MerchantWithDistance }>>(new Map());
  const animationFrameRef = useRef<number>(0);
  const [pulsePhase, setPulsePhase] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    drawRadarBackground(ctx, width, height, radiusKm, DEFAULT_COLORS);

    const activeOrders = orders.filter(o => o.status === 'pending');

    activeOrders.forEach(order => {
      const point = latLngToCanvasPoint(
        order.lat, order.lng,
        centerLat, centerLng,
        radiusKm, width, height
      );

      const pulseRadius = 5 + 15 * (1 + Math.sin(pulsePhase + order.createdAt * 0.001)) / 2;

      ctx.beginPath();
      ctx.arc(point.x, point.y, pulseRadius, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, pulseRadius
      );
      gradient.addColorStop(0, 'rgba(255, 107, 107, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 107, 107, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    });

    merchantMapRef.current = drawMerchants(
      ctx, merchants, centerLat, centerLng, radiusKm, width, height, DEFAULT_COLORS
    );

    orderMapRef.current = drawOrders(
      ctx, orders, centerLat, centerLng, radiusKm, width, height, selectedOrderId, DEFAULT_COLORS
    );

    if (hoveredItem) {
      if (hoveredItem.type === 'order') {
        const orderInfo = orderMapRef.current.get(hoveredItem.id);
        if (orderInfo) {
          const distance = calculateDistance(centerLat, centerLng, orderInfo.order.lat, orderInfo.order.lng);
          drawTooltip(
            ctx,
            orderInfo.x,
            orderInfo.y,
            `${orderInfo.order.merchantName} - ${distance.toFixed(2)}km`,
            orderInfo.x < width / 2
          );
        }
      } else if (hoveredItem.type === 'merchant') {
        const merchantInfo = merchantMapRef.current.get(hoveredItem.id);
        if (merchantInfo) {
          const distance = calculateDistance(centerLat, centerLng, merchantInfo.merchant.lat, merchantInfo.merchant.lng);
          drawTooltip(
            ctx,
            merchantInfo.x,
            merchantInfo.y,
            `${merchantInfo.merchant.name} - ${merchantInfo.merchant.rating}★ - ${distance.toFixed(2)}km`,
            merchantInfo.x < width / 2
          );
        }
      }
    }
  }, [centerLat, centerLng, radiusKm, orders, merchants, selectedOrderId, hoveredItem, width, height, pulsePhase]);

  useEffect(() => {
    const animate = () => {
      setPulsePhase(prev => prev + 0.05);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    for (const [, { x: ox, y: oy, order }] of orderMapRef.current.entries()) {
      const distance = Math.sqrt(Math.pow(x - ox, 2) + Math.pow(y - oy, 2));
      if (distance <= 15) {
        onOrderClick?.(order);
        return;
      }
    }

    for (const [, { x: mx, y: my, merchant }] of merchantMapRef.current.entries()) {
      const distance = Math.sqrt(Math.pow(x - mx, 2) + Math.pow(y - my, 2));
      if (distance <= 15) {
        onMerchantClick?.(merchant);
        return;
      }
    }
  }, [onOrderClick, onMerchantClick]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let found: { type: 'order' | 'merchant'; id: string } | null = null;

    for (const [id, { x: ox, y: oy }] of orderMapRef.current.entries()) {
      const distance = Math.sqrt(Math.pow(x - ox, 2) + Math.pow(y - oy, 2));
      if (distance <= 15) {
        found = { type: 'order', id };
        break;
      }
    }

    if (!found) {
      for (const [id, { x: mx, y: my }] of merchantMapRef.current.entries()) {
        const distance = Math.sqrt(Math.pow(x - mx, 2) + Math.pow(y - my, 2));
        if (distance <= 15) {
          found = { type: 'merchant', id };
          break;
        }
      }
    }

    setHoveredItem(found);
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  return (
    <div className="spatial-radar-chart" style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          cursor: hoveredItem ? 'pointer' : 'default',
          borderRadius: '50%'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -25,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '16px',
          fontSize: '12px',
          color: 'rgba(150, 180, 255, 0.8)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: DEFAULT_COLORS.order
            }}
          />
          <span>活跃订单</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '0',
              height: '0',
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderBottom: `8px solid ${DEFAULT_COLORS.merchantActive}`
            }}
          />
          <span>活跃商家</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: DEFAULT_COLORS.centerPoint
            }}
          />
          <span>当前位置</span>
        </div>
      </div>
    </div>
  );
};
