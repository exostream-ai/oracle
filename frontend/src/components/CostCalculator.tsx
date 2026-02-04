'use client';

import { useState, useEffect } from 'react';
import { priceTask, formatCost, formatNumber, type GreekData } from '@/lib/api';

interface CostCalculatorProps {
  models: GreekData[];
}

const PRESETS = {
  rag: { name: 'RAG Query', n_in: 30000, n_out: 800, eta: 0.6 },
  code: { name: 'Code Generation', n_in: 5000, n_out: 2000, eta: 0.2 },
  summary: { name: 'Summarization', n_in: 50000, n_out: 500, eta: 0.0 },
  chat: { name: 'Chat Turn', n_in: 2000, n_out: 500, eta: 0.8 },
};

export default function CostCalculator({ models }: CostCalculatorProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [nIn, setNIn] = useState(30000);
  const [nOut, setNOut] = useState(800);
  const [eta, setEta] = useState(0.6);
  const [horizon, setHorizon] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default model
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].ticker);
    }
  }, [models, selectedModel]);

  // Calculate on param change
  useEffect(() => {
    if (!selectedModel) return;

    const calculate = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await priceTask({
          model: selectedModel,
          n_in: nIn,
          n_out: nOut,
          eta,
          horizon_months: horizon > 0 ? horizon : undefined,
        });
        setResult(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Calculation failed');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(calculate, 300);
    return () => clearTimeout(debounce);
  }, [selectedModel, nIn, nOut, eta, horizon]);

  const applyPreset = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    setNIn(preset.n_in);
    setNOut(preset.n_out);
    setEta(preset.eta);
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Cost Calculator</h3>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => applyPreset(key as keyof typeof PRESETS)}
            className="btn btn-secondary text-xs"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="select"
            >
              {models.map((m) => (
                <option key={m.ticker} value={m.ticker}>
                  {m.ticker} - {m.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Input Tokens (n_in): {formatNumber(nIn)}
            </label>
            <input
              type="range"
              min={0}
              max={200000}
              step={1000}
              value={nIn}
              onChange={(e) => setNIn(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Output Tokens (n_out): {formatNumber(nOut)}
            </label>
            <input
              type="range"
              min={1}
              max={10000}
              step={100}
              value={nOut}
              onChange={(e) => setNOut(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Cache Hit Rate (η): {(eta * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={eta}
              onChange={(e) => setEta(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Forward Horizon: {horizon === 0 ? 'Spot' : `${horizon}M`}
            </label>
            <input
              type="range"
              min={0}
              max={6}
              step={1}
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Results */}
        <div className="bg-surface-light rounded-lg p-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-8 bg-border rounded w-1/2"></div>
              <div className="h-4 bg-border rounded w-3/4"></div>
            </div>
          ) : error ? (
            <div className="text-negative">{error}</div>
          ) : result ? (
            <div className="space-y-4">
              <div>
                <div className="text-text-secondary text-sm">Spot Cost</div>
                <div className="text-3xl font-mono font-semibold text-accent">
                  {formatCost(result.data.spot_cost)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-text-secondary text-xs">κ (Delta)</div>
                  <div className="font-mono">{result.data.kappa.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-text-secondary text-xs">r_in_eff</div>
                  <div className="font-mono">{result.data.r_in_eff.toFixed(4)}</div>
                </div>
              </div>

              {result.data.forward && (
                <div className="border-t border-border pt-4">
                  <div className="text-text-secondary text-sm">
                    {horizon}M Forward Cost
                  </div>
                  <div className="text-xl font-mono">
                    {formatCost(result.data.forward.cost)}
                  </div>
                  <div className="text-text-secondary text-xs">
                    β_fwd = ${result.data.forward.beta_forward.toFixed(2)}/M
                  </div>
                </div>
              )}

              {result.data.cache_value && (
                <div className="border-t border-border pt-4">
                  <div className="text-text-secondary text-sm">Cache Savings</div>
                  <div className="text-xl font-mono text-positive">
                    -{formatCost(result.data.cache_value.savings)}
                  </div>
                  <div className="text-text-secondary text-xs">
                    {result.data.cache_value.savings_pct.toFixed(1)}% reduction
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-text-secondary">Select a model to calculate</div>
          )}
        </div>
      </div>
    </div>
  );
}
