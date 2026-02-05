'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, Time } from 'lightweight-charts';
import { type ForwardData } from '@/lib/api';

interface ForwardCurveProps {
  spot: number;
  forwards: ForwardData[];
  theta: number;
  ticker: string;
}

// Helper to get YYYY-MM-DD string for a date offset by months
function getDateString(monthsFromNow: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  return date.toISOString().split('T')[0];
}

// Helper to format date as "Mon YYYY" or "Spot"
function formatTenor(monthsFromNow: number): string {
  if (monthsFromNow === 0) return 'Spot';
  const date = new Date();
  date.setMonth(date.getMonth() + monthsFromNow);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
}

export default function ForwardCurve({ spot, forwards, theta, ticker }: ForwardCurveProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

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
        tickMarkFormatter: (time: Time) => {
          // Map time back to tenor label
          const timeStr = time as string;
          const date = new Date(timeStr);
          const now = new Date();
          const monthsDiff = (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
          return formatTenor(monthsDiff);
        },
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

    // Build forward curve data with actual dates
    const tenorMonths = [0, 1, 3, 6];
    const tenorMap: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6 };

    const data: { time: Time; value: number }[] = [
      { time: getDateString(0) as Time, value: spot }
    ];

    for (const fwd of forwards) {
      const month = tenorMap[fwd.tenor];
      if (month !== undefined) {
        data.push({ time: getDateString(month) as Time, value: fwd.beta_forward });
      }
    }

    // Sort by time to ensure correct order
    data.sort((a, b) => (a.time as string).localeCompare(b.time as string));

    series.setData(data);
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
  }, [spot, forwards, theta]);

  return (
    <div className="terminal-box">
      <div className="p-4 border-b border-[#262626]">
        <div className="flex items-center justify-between">
          <h3 className="mono text-sm text-[#e5e5e5]">{ticker} Forward Curve</h3>
          <span className="mono text-xs text-[#737373]">
            θ = {(theta * 100).toFixed(1)}%/mo
          </span>
        </div>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
}
