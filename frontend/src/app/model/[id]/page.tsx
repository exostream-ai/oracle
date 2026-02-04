'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ForwardCurve from '@/components/ForwardCurve';
import HistoryChart from '@/components/HistoryChart';
import { getGreeks, getForwards, getHistory, formatPrice, formatTheta, type GreekData, type ForwardData } from '@/lib/api';

export default function ModelDetailPage() {
  const params = useParams();
  const modelId = params.id as string;

  const [model, setModel] = useState<GreekData | null>(null);
  const [forwards, setForwards] = useState<ForwardData[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch model Greeks
        const greeksResponse = await getGreeks();
        const foundModel = greeksResponse.data.find(m => m.model_id === modelId);

        if (!foundModel) {
          setError('Model not found');
          setLoading(false);
          return;
        }

        setModel(foundModel);

        // Fetch forwards
        try {
          const forwardsResponse = await getForwards(foundModel.ticker);
          setForwards(forwardsResponse.data.forwards);
        } catch {
          // No forwards available
        }

        // Fetch history
        try {
          const historyResponse = await getHistory(foundModel.ticker);
          setHistory(historyResponse.data.prices);
        } catch {
          // No history available
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-12 bg-surface rounded w-1/3"></div>
          <div className="h-64 bg-surface rounded"></div>
          <div className="h-64 bg-surface rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="card text-center py-12">
          <p className="text-negative text-lg">{error || 'Model not found'}</p>
          <a href="/" className="btn btn-primary mt-4">Back to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-3xl font-bold">{model.ticker}</h1>
          <span className="bg-surface-light px-3 py-1 rounded text-text-secondary text-sm">
            {model.provider}
          </span>
          {model.is_reasoning && (
            <span className="bg-accent/20 text-accent px-3 py-1 rounded text-sm">
              Reasoning
            </span>
          )}
        </div>
        <p className="text-text-secondary text-lg">{model.display_name}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-text-secondary text-sm mb-1">β (Sync)</div>
          <div className="text-2xl font-mono font-semibold">
            {formatPrice(model.beta_sync)}/M
          </div>
        </div>
        <div className="card">
          <div className="text-text-secondary text-sm mb-1">β (Batch)</div>
          <div className="text-2xl font-mono font-semibold">
            {model.beta_batch ? `${formatPrice(model.beta_batch)}/M` : '-'}
          </div>
        </div>
        <div className="card">
          <div className="text-text-secondary text-sm mb-1">θ (Decay)</div>
          <div className={`text-2xl font-mono font-semibold ${
            model.theta && model.theta > 0 ? 'text-negative' : 'text-positive'
          }`}>
            {formatTheta(model.theta)}
          </div>
        </div>
        <div className="card">
          <div className="text-text-secondary text-sm mb-1">Context Window</div>
          <div className="text-2xl font-mono font-semibold">
            {(model.context_window / 1000).toFixed(0)}K
          </div>
        </div>
      </div>

      {/* Greek Sheet */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">Greek Sheet</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-text-secondary text-xs uppercase tracking-wide">r_in</div>
            <div className="font-mono text-lg">{model.r_in.toFixed(4)}</div>
          </div>
          <div>
            <div className="text-text-secondary text-xs uppercase tracking-wide">r_cache</div>
            <div className="font-mono text-lg">{model.r_cache.toFixed(4)}</div>
          </div>
          {model.r_think !== undefined && (
            <div>
              <div className="text-text-secondary text-xs uppercase tracking-wide">r_think</div>
              <div className="font-mono text-lg">{model.r_think.toFixed(4)}</div>
            </div>
          )}
          {model.r_batch !== undefined && (
            <div>
              <div className="text-text-secondary text-xs uppercase tracking-wide">r_batch</div>
              <div className="font-mono text-lg">{model.r_batch.toFixed(4)}</div>
            </div>
          )}
          <div>
            <div className="text-text-secondary text-xs uppercase tracking-wide">σ (Volatility)</div>
            <div className="font-mono text-lg">
              {model.sigma !== undefined ? `${(model.sigma * 100).toFixed(2)}%` : '-'}
            </div>
          </div>
          {model.family_prior_weight !== undefined && (
            <div>
              <div className="text-text-secondary text-xs uppercase tracking-wide">Prior Weight</div>
              <div className="font-mono text-lg">{(model.family_prior_weight * 100).toFixed(0)}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {model.beta_sync && model.theta !== undefined && (
          <ForwardCurve
            spot={model.beta_sync}
            forwards={forwards}
            theta={model.theta}
            ticker={model.ticker}
          />
        )}
        {history.length > 0 && (
          <HistoryChart prices={history} ticker={model.ticker} />
        )}
      </div>
    </div>
  );
}
