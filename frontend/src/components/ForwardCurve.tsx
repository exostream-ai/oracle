'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData } from 'lightweight-charts';
import { type ForwardData } from '@/lib/api';

interface ForwardCurveProps {
  spot: number;
  forwards: ForwardData[];
  theta: number;
  ticker: string;
}

export default function ForwardCurve({ spot, forwards, theta, ticker }: ForwardCurveProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

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
        timeVisible: false,
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

    seriesRef.current = series;

    // Build data points
    const data: LineData[] = [
      { time: 0 as any, value: spot },
    ];

    const tenorMonths: Record<string, number> = {
      '1M': 1,
      '3M': 3,
      '6M': 6,
    };

    for (const fwd of forwards) {
      const month = tenorMonths[fwd.tenor];
      if (month !== undefined) {
        data.push({ time: month as any, value: fwd.beta_forward });
      }
    }

    series.setData(data);

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
  }, [spot, forwards]);

  return (
    <div className="chart-container">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold">{ticker} Forward Curve</h3>
        <p className="text-text-secondary text-sm">
          θ = {(theta * 100).toFixed(1)}%/mo • Spot → 6M projection
        </p>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
}
