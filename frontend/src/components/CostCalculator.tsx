'use client';

import { useState, useEffect } from 'react';
import { priceTask, type GreekData } from '@/lib/api';

interface CostCalculatorProps {
  models: GreekData[];
  defaultModel?: string;
}

const PRESETS = {
  rag: { name: 'RAG', n_in: 30000, n_out: 800, n_think: 0, eta: 0.6 },
  code: { name: 'Code Gen', n_in: 5000, n_out: 2000, n_think: 0, eta: 0.2 },
  summary: { name: 'Summarize', n_in: 50000, n_out: 500, n_think: 0, eta: 0 },
};

function formatCost(cost: number): string {
  if (cost < 0.001) return `$${(cost * 1000).toFixed(4)}m`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

export default function CostCalculator({ models, defaultModel }: CostCalculatorProps) {
  const [model, setModel] = useState(defaultModel || '');
  const [nIn, setNIn] = useState(30000);
  const [nOut, setNOut] = useState(800);
  const [nThink, setNThink] = useState(0);
  const [eta, setEta] = useState(0.6);
  const [horizon, setHorizon] = useState(3);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>('rag');

  // Set default model to OPUS-4.5 if available
  useEffect(() => {
    if (models.length > 0 && !model) {
      const opus = models.find(m => m.ticker === 'OPUS-4.5');
      setModel(opus?.ticker || models[0].ticker);
    }
  }, [models, model]);

  // Calculate on param change
  useEffect(() => {
    if (!model) return;

    const calculate = async () => {
      setLoading(true);
      try {
        const response = await priceTask({
          model,
          n_in: nIn,
          n_out: nOut,
          n_think: nThink,
          eta,
          horizon_months: horizon > 0 ? horizon : undefined,
        });
        setResult(response.data);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(calculate, 200);
    return () => clearTimeout(debounce);
  }, [model, nIn, nOut, nThink, eta, horizon]);

  const applyPreset = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    setNIn(preset.n_in);
    setNOut(preset.n_out);
    setNThink(preset.n_think);
    setEta(preset.eta);
    setActivePreset(key);
  };

  const selectedModel = models.find(m => m.ticker === model);
  const isReasoning = selectedModel?.is_reasoning;

  return (
    <div className="terminal-box">
      <div className="p-3 border-b border-[#262626]">
        <div className="flex items-center justify-between">
          <h3 className="mono text-sm text-[#e5e5e5]">Cost Calculator</h3>
          <div className="flex gap-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(key as keyof typeof PRESETS)}
                className={activePreset === key ? 'active' : ''}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-2 gap-4">
          {/* Left: Inputs */}
          <div className="space-y-3">
            {/* Model */}
            <div>
              <label className="block text-[#737373] text-xs mono mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value); setActivePreset(null); }}
                className="w-full"
              >
                {models.map((m) => (
                  <option key={m.ticker} value={m.ticker}>
                    {m.ticker}
                  </option>
                ))}
              </select>
            </div>

            {/* n_in */}
            <div>
              <div className="flex justify-between text-xs mono mb-1">
                <span className="text-[#737373]">n_in</span>
                <span className="text-[#e5e5e5]">{formatNumber(nIn)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={200000}
                step={1000}
                value={nIn}
                onChange={(e) => { setNIn(parseInt(e.target.value)); setActivePreset(null); }}
              />
            </div>

            {/* n_out */}
            <div>
              <div className="flex justify-between text-xs mono mb-1">
                <span className="text-[#737373]">n_out</span>
                <span className="text-[#e5e5e5]">{formatNumber(nOut)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={16000}
                step={100}
                value={nOut}
                onChange={(e) => { setNOut(parseInt(e.target.value)); setActivePreset(null); }}
              />
            </div>

            {/* n_think (only for reasoning models) */}
            {isReasoning && (
              <div>
                <div className="flex justify-between text-xs mono mb-1">
                  <span className="text-[#737373]">n_think</span>
                  <span className="text-[#e5e5e5]">{formatNumber(nThink)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={32000}
                  step={1000}
                  value={nThink}
                  onChange={(e) => { setNThink(parseInt(e.target.value)); setActivePreset(null); }}
                />
              </div>
            )}

            {/* eta */}
            <div>
              <div className="flex justify-between text-xs mono mb-1">
                <span className="text-[#737373]">cache hit (eta)</span>
                <span className="text-[#e5e5e5]">{(eta * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={eta}
                onChange={(e) => { setEta(parseFloat(e.target.value)); setActivePreset(null); }}
              />
            </div>

            {/* horizon */}
            <div>
              <div className="flex justify-between text-xs mono mb-1">
                <span className="text-[#737373]">horizon</span>
                <span className="text-[#e5e5e5]">{horizon === 0 ? 'Spot' : `${horizon}M`}</span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                step={1}
                value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Right: Results */}
          <div className="bg-[#0a0a0a] p-3 border border-[#262626]">
            {loading ? (
              <div className="space-y-3">
                <div className="h-10 bg-[#1a1a1a] loading-pulse" />
                <div className="h-6 bg-[#1a1a1a] loading-pulse w-2/3" />
              </div>
            ) : result ? (
              <div className="space-y-3">
                {/* Spot Cost */}
                <div>
                  <div className="text-[#737373] text-xs mono">Spot Cost</div>
                  <div className="text-2xl mono font-semibold text-[#06b6d4]">
                    {formatCost(result.spot_cost)}
                  </div>
                </div>

                {/* Kappa & r_in_eff */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[#525252] text-xs mono">kappa</div>
                    <div className="mono text-[#e5e5e5]">{result.kappa.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[#525252] text-xs mono">r_in_eff</div>
                    <div className="mono text-[#e5e5e5]">{result.r_in_eff.toFixed(4)}</div>
                  </div>
                </div>

                {/* Forward */}
                {result.forward && (
                  <div className="pt-2 border-t border-[#262626]">
                    <div className="text-[#737373] text-xs mono">{horizon}M Forward</div>
                    <div className="mono text-base text-[#e5e5e5]">
                      {formatCost(result.forward.cost)}
                    </div>
                    <div className="text-[#525252] text-xs mono">
                      beta_fwd = ${result.forward.beta_forward.toFixed(2)}
                    </div>
                  </div>
                )}

                {/* Cache Savings */}
                {result.cache_value && (
                  <div className="pt-2 border-t border-[#262626]">
                    <div className="text-[#737373] text-xs mono">Cache Savings</div>
                    <div className="mono text-base text-[#22c55e]">
                      -{formatCost(result.cache_value.savings)}
                    </div>
                    <div className="text-[#525252] text-xs mono">
                      {result.cache_value.savings_pct.toFixed(1)}% reduction
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[#525252] mono text-sm">Select a model</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
