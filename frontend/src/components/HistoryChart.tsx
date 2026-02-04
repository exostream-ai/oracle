'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData } from 'lightweight-charts';

interface PricePoint {
  beta: number;
  timestamp: string;
  provenance: string;
}

interface HistoryChartProps {
  prices: PricePoint[];
  ticker: string;
}

export default function HistoryChart({ prices, ticker }: HistoryChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || prices.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#141414' },
        textColor: '#737373',
      },
      grid: {
        vertLines: { color: '#262626' },
        horzLines: { color: '#262626' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      rightPriceScale: {
        borderColor: '#262626',
      },
      timeScale: {
        borderColor: '#262626',
        timeVisible: true,
        secondsVisible: false,
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

    // Create line series
    const series = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Convert prices to chart data
    const data: LineData[] = prices.map(p => ({
      time: Math.floor(new Date(p.timestamp).getTime() / 1000) as any,
      value: p.beta,
    }));

    series.setData(data);

    // Add markers for reconstructed vs live data
    const markers = prices
      .filter(p => p.provenance === 'reconstructed')
      .map(p => ({
        time: Math.floor(new Date(p.timestamp).getTime() / 1000) as any,
        position: 'belowBar' as const,
        color: '#737373',
        shape: 'circle' as const,
        text: '',
      }));

    if (markers.length > 0) {
      series.setMarkers(markers);
    }

    // Handle resize
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
    <div className="chart-container">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold">{ticker} Price History</h3>
        <p className="text-text-secondary text-sm">
          ○ Reconstructed • ● Live observations
        </p>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
}
