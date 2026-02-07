'use client';

import { useState, useEffect } from 'react';
import ForwardCurve from '@/components/ForwardCurve';
import HistoryChart from '@/components/HistoryChart';
import { getGreeks, getForwards, getHistory, type GreekData, type ForwardData } from '@/lib/api';

function formatPrice(price?: number): string {
  if (price === undefined) return '-';
  return `$${price.toFixed(2)}`;
}

function formatTheta(theta?: number): string {
  if (theta === undefined) return '-';
  const pct = Math.abs(theta * 100).toFixed(1);
  return theta > 0 ? `-${pct}%/mo` : `+${pct}%/mo`;
}

interface ModelDetailClientProps {
  modelId: string;
}

export default function ModelDetailClient({ modelId }: ModelDetailClientProps) {
  const [model, setModel] = useState<GreekData | null>(null);
  const [forwards, setForwards] = useState<ForwardData[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forwardsError, setForwardsError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const greeksResponse = await getGreeks();
        const foundModel = greeksResponse.data.find(m => m.model_id === modelId);

        if (!foundModel) {
          setError('Model not found');
          setLoading(false);
          return;
        }

        setModel(foundModel);

        try {
          const forwardsResponse = await getForwards(foundModel.ticker);
          setForwards(forwardsResponse.data.forwards);
        } catch (err) {
          console.error('Failed to load forwards:', err);
          setForwardsError('Failed to load forward curve.');
        }

        try {
          const historyResponse = await getHistory(foundModel.ticker);
          setHistory(historyResponse.data.prices);
        } catch (err) {
          console.error('Failed to load history:', err);
          setHistoryError('Failed to load price history.');
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
        setLoading(false);
      }
    }

    fetchData();
  }, [modelId]);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="space-y-6">
          <div className="h-12 bg-[#141414] loading-pulse w-1/3" />
          <div className="h-64 bg-[#141414] loading-pulse" />
        </div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="terminal-box p-8 text-center">
          <p className="text-[#ef4444] mono">{error || 'Model not found'}</p>
          <a href="/" className="inline-block mt-4 text-[#06b6d4] mono text-sm">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-1">
          <h1 className="text-2xl mono font-semibold text-[#06b6d4]">{model.ticker}</h1>
          <span className="text-[#525252] text-xs mono px-2 py-1 border border-[#262626]">
            {model.provider}
          </span>
          {model.is_reasoning && (
            <span className="text-[#06b6d4] text-xs mono px-2 py-1 border border-[#06b6d4]/30">
              reasoning
            </span>
          )}
        </div>
        <p className="text-[#737373] text-sm">{model.display_name}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="terminal-box p-4">
          <div className="text-[#525252] text-xs mono mb-1">beta (sync)</div>
          <div className="mono text-xl">{formatPrice(model.beta_sync)}</div>
        </div>
        <div className="terminal-box p-4">
          <div className="text-[#525252] text-xs mono mb-1">beta (batch)</div>
          <div className="mono text-xl text-[#737373]">{formatPrice(model.beta_batch)}</div>
        </div>
        <div className="terminal-box p-4">
          <div className="text-[#525252] text-xs mono mb-1">theta</div>
          <div className={`mono text-xl ${model.theta && model.theta > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatTheta(model.theta)}
          </div>
        </div>
        <div className="terminal-box p-4">
          <div className="text-[#525252] text-xs mono mb-1">context</div>
          <div className="mono text-xl">{(model.context_window / 1000).toFixed(0)}K</div>
        </div>
      </div>

      {/* Greek Sheet */}
      <div className="terminal-box mb-8">
        <div className="p-4 border-b border-[#262626]">
          <h2 className="mono text-sm text-[#e5e5e5]">Greek Sheet</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-6 gap-4">
            <div>
              <div className="text-[#525252] text-xs mono mb-1">r_in</div>
              <div className="mono">{model.r_in.toFixed(4)}</div>
            </div>
            <div>
              <div className="text-[#525252] text-xs mono mb-1">r_cache</div>
              <div className="mono">{model.r_cache.toFixed(4)}</div>
            </div>
            {model.r_think !== undefined && (
              <div>
                <div className="text-[#525252] text-xs mono mb-1">r_think</div>
                <div className="mono">{model.r_think.toFixed(4)}</div>
              </div>
            )}
            {model.r_batch !== undefined && (
              <div>
                <div className="text-[#525252] text-xs mono mb-1">r_batch</div>
                <div className="mono">{model.r_batch.toFixed(4)}</div>
              </div>
            )}
            <div>
              <div className="text-[#525252] text-xs mono mb-1">sigma</div>
              <div className="mono">
                {model.sigma !== undefined ? `${(model.sigma * 100).toFixed(2)}%` : '-'}
              </div>
            </div>
            <div>
              <div className="text-[#525252] text-xs mono mb-1">theta</div>
              <div className="mono">
                {model.theta !== undefined ? `${(model.theta * 100).toFixed(2)}%` : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {forwardsError ? (
          <div className="terminal-box p-4 text-center">
            <p className="text-[#ef4444] mono text-sm">{forwardsError}</p>
          </div>
        ) : model.beta_sync && model.theta !== undefined && (
          <ForwardCurve
            spot={model.beta_sync}
            forwards={forwards}
            theta={model.theta}
            ticker={model.ticker}
          />
        )}
        {historyError ? (
          <div className="terminal-box p-4 text-center">
            <p className="text-[#ef4444] mono text-sm">{historyError}</p>
          </div>
        ) : history.length > 0 && (
          <HistoryChart prices={history} ticker={model.ticker} />
        )}
      </div>
    </div>
  );
}
