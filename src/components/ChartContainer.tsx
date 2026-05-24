import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number | string;
  aspect?: number;
}

export default function ChartContainer({ children, height = "100%", aspect }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const rect = entries[0].contentRect;
      if (rect.width > 0) {
        setWidth(rect.width);
        setIsReady(true);
      }
    });

    observer.observe(el);

    // Immediate fallback measurement
    const initialWidth = el.getBoundingClientRect().width || el.offsetWidth;
    if (initialWidth > 0) {
      setWidth(initialWidth);
      setIsReady(true);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!isReady || width <= 0) {
    return (
      <div 
        ref={containerRef} 
        className="w-full relative flex items-center justify-center text-on-surface-variant/40 text-[10px] font-black uppercase tracking-widest bg-surface/50 rounded-2xl border border-outline-variant/30 min-h-[250px]"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        <span className="animate-pulse">Calcul de la géométrie du graphique...</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative min-h-0 min-w-0"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <ResponsiveContainer width="100%" height="100%" aspect={aspect}>
        {children as any}
      </ResponsiveContainer>
    </div>
  );
}
