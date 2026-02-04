'use client';

import { formatPrice, formatTheta, type GreekData } from '@/lib/api';

interface TickerStripProps {
  models: GreekData[];
  loading: boolean;
}

export default function TickerStrip({ models, loading }: TickerStripProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-8">
        <span className="text-text-secondary animate-pulse">Loading...</span>
      </div>
    );
  }

  // Duplicate the list for infinite scroll effect
  const items = [...models, ...models];

  return (
    <div className="relative overflow-hidden">
      <div className="ticker-strip whitespace-nowrap">
        {items.map((model, idx) => (
          <a
            key={`${model.ticker}-${idx}`}
            href={`/model/${model.model_id}`}
            className="inline-flex items-center gap-3 px-6 hover:bg-surface-light transition-colors"
          >
            <span className="font-mono font-semibold text-accent">
              {model.ticker}
            </span>
            <span className="font-mono">
              {formatPrice(model.beta_sync)}/M
            </span>
            <span className={`font-mono text-sm ${
              model.theta && model.theta > 0 ? 'text-negative' : 'text-positive'
            }`}>
              {formatTheta(model.theta)}
            </span>
            <span className="text-text-muted">•</span>
          </a>
        ))}
      </div>
    </div>
  );
}
