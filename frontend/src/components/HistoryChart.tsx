'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, Time } from 'lightweight-charts';

interface PricePoint {
  beta: number;
  timestamp: string;
  provenance: string;
}

interface HistoryChartProps {
  prices: PricePoint[];
  ticker: string;
}

// Convert timestamp to YYYY-MM-DD string format for lightweight-charts
function toDateString(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

export default function HistoryChart({ prices, ticker }: HistoryChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || prices.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#141414' },
        textColor: '#737373',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 280,
      rightPriceScale: {
        borderColor: '#262626',
      },
      timeScale: {
        borderColor: '#262626',
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        horzLine: {
          color: '#06b6d4',
          labelBackgroundColor: '#06b6d4',
        },
        vertLine: {
          color: '#06b6d4',
          labelBackgroundColor: '#06b6d4',
        },
      },
    });

    chartRef.current = chart;

    const series = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Deduplicate by date string (YYYY-MM-DD) and sort
    const dateMap = new Map<string, number>();
    for (const p of prices) {
      const dateStr = toDateString(p.timestamp);
      // Keep the latest value for each date
      dateMap.set(dateStr, p.beta);
    }

    const data = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([time, value]) => ({ time: time as Time, value }));

    if (data.length > 0) {
      series.setData(data);
    }

    // Mark reconstructed data points
    const reconstructedDates = new Set<string>();
    for (const p of prices) {
      if (p.provenance === 'reconstructed') {
        reconstructedDates.add(toDateString(p.timestamp));
      }
    }

    const markers = Array.from(reconstructedDates)
      .sort((a, b) => a.localeCompare(b))
      .map(time => ({
        time: time as Time,
        position: 'belowBar' as const,
        color: '#525252',
        shape: 'circle' as const,
        text: '',
      }));

    if (markers.length > 0) {
      series.setMarkers(markers);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [prices]);

  return (
    <div className="terminal-box">
      <div className="p-4 border-b border-[#262626]">
        <div className="flex items-center justify-between">
          <h3 className="mono text-sm text-[#e5e5e5]">{ticker} Price History</h3>
          <span className="mono text-xs text-[#525252]">
            o reconstructed
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
}
