'use client';

import { type GreekData } from '@/lib/api';

interface TickerStripProps {
  models: GreekData[];
  loading: boolean;
}

function formatPrice(price?: number): string {
  if (price === undefined) return '-';
  return `$${price.toFixed(2)}`;
}

function formatTheta(theta?: number): string {
  if (theta === undefined) return '';
  const pct = Math.abs(theta * 100).toFixed(1);
  // Positive theta means price is declining (good)
  return theta > 0 ? `↓${pct}%/mo` : `↑${pct}%/mo`;
}

export default function TickerStrip({ models, loading }: TickerStripProps) {
  if (loading) {
    return (
      <div className="h-8 flex items-center justify-center">
        <span className="text-[#525252] text-sm mono loading-pulse">Loading...</span>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="h-8 flex items-center justify-center">
        <span className="text-[#525252] text-sm mono">No data available</span>
      </div>
    );
  }

  // Duplicate for infinite scroll
  const items = [...models, ...models];

  return (
    <div className="relative overflow-hidden">
      <div className="ticker-animate flex whitespace-nowrap py-2">
        {items.map((model, idx) => (
          <a
            key={`${model.ticker}-${idx}`}
            href={`/model/${model.model_id}`}
            className="inline-flex items-center gap-2 px-6 hover:bg-[#1a1a1a] transition-colors text-sm"
          >
            <span className="mono font-semibold text-[#06b6d4]">
              {model.ticker}
            </span>
            <span className="mono text-[#e5e5e5]">
              {formatPrice(model.beta_sync)}
            </span>
            <span className={`mono text-sm ${model.theta && model.theta > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {formatTheta(model.theta)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
