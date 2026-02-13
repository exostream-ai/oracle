'use client';

import { useState, useEffect, useRef } from 'react';
import CostCalculator from '@/components/CostCalculator';
import ExposureCalculator from '@/components/ExposureCalculator';
import { getGreeks, type GreekData } from '@/lib/api';

export default function CalculatorsPage() {
  const [models, setModels] = useState<GreekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await getGreeks();
        setModels(response.data);
        setError(null);
      } catch (err) {
        console.error('Failed to load model data:', err);
        if (retryCountRef.current === 0) {
          retryCountRef.current++;
          fetchModels();
          return;
        }
        setError('Failed to load model data.');
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
    const interval = setInterval(fetchModels, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    retryCountRef.current = 0;
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="terminal-box p-6">
          <div className="h-96 bg-[#1a1a1a] loading-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="terminal-box p-6 text-center">
          <p className="text-[#ef4444] mono mb-2">{error}</p>
          <button onClick={handleRetry} className="text-[#06b6d4] mono text-sm hover:underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl mono mb-2">Calculators</h1>
        <p className="text-[#737373] text-sm">
          Price a single inference call, or model your full system cost exposure and unit economics.
        </p>
      </div>

      {/* ── Cost Calculator ─────────────────────────────────── */}
      <section id="cost-calculator" className="mb-12">
        <div className="mb-4">
          <h2 className="text-lg mono text-[#e5e5e5] mb-1">Cost Calculator</h2>
          <p className="text-[#737373] text-sm">
            Calculate inference cost for a single task profile. Adjust model, token counts, cache rate, and forward horizon.
          </p>
        </div>
        <CostCalculator models={models} defaultModel="OPUS-4.5" />

        {/* How It Works */}
        <div className="terminal-box mt-4">
          <div className="p-4 border-b border-[#262626]">
            <h3 className="mono text-sm text-[#e5e5e5]">How It Works</h3>
          </div>
          <div className="p-4 space-y-4 text-[#737373] text-sm">
            <p>
              <span className="mono text-[#e5e5e5]">kappa</span> is your context cost multiplier.
              It tells you how many times more expensive your task is compared to pure output generation.
              A kappa of 4.5 means your task costs 4.5x the base output rate.
            </p>
            <p>
              <span className="mono text-[#e5e5e5]">r_in_eff</span> is the effective input rate after
              accounting for cache hits. Higher cache hit rate (eta) means lower effective input cost.
            </p>
            <p>
              <span className="mono text-[#e5e5e5]">Forward cost</span> projects what your task would
              cost at a future date, based on the model&apos;s decay rate (theta). Prices tend to fall over time.
            </p>
          </div>
        </div>
      </section>

      {/* ── System Canvas ───────────────────────────────────── */}
      <section id="system-canvas">
        <div className="mb-4">
          <h2 className="text-lg mono text-[#e5e5e5] mb-1">System Canvas</h2>
          <p className="text-[#737373] text-sm">
            Model your AI cost exposure and unit economics. Pick a workflow or business archetype,
            see system architecture, inference costs, profit margins, and optimization levers.
          </p>
        </div>
        <ExposureCalculator models={models} />

        {/* Methodology */}
        <div className="terminal-box mt-4">
          <div className="p-4 border-b border-[#262626]">
            <h3 className="mono text-sm text-[#e5e5e5]">How It Works</h3>
          </div>
          <div className="p-4 space-y-4 text-[#737373] text-sm">
            <p>
              <span className="mono text-[#e5e5e5]">Inference Cost (C)</span> is computed as:
              monthly calls &times; blended cost per call, weighted by model mix and task distribution.
              Cost per call uses the Exostream pricing model: S = &beta; &times; (n_out + n_in &times; r_in_eff) &times; 10&#x207B;&#x2076;.
            </p>
            <p>
              <span className="mono text-[#e5e5e5]">kappa</span> is the portfolio-weighted context
              cost multiplier. Higher kappa means input context dominates cost &mdash; optimize with
              caching and shorter prompts. Lower kappa means output-heavy workloads.
            </p>
            <p>
              <span className="mono text-[#e5e5e5]">theta</span> is the weighted monthly price decay
              rate. Forward projections use exponential decay: C(t) = C &times; e^(-&theta; &times; t).
              LLM prices fall 2-12% per month historically.
            </p>
            <p>
              <span className="mono text-[#e5e5e5]">Unit Economics</span> uses the profit function:
              &pi;(x) = x&middot;p &minus; C(x) &minus; x&middot;t &minus; F, where x = volume,
              p = revenue per task, C(x) = inference cost from Exostream, t = overhead per task,
              F = fixed monthly costs. Break-even volume = F / (p &minus; c &minus; t) where c = cost per call.
            </p>
            <p>
              <span className="mono text-[#e5e5e5]">Optimization Levers</span> are ranked by monthly
              savings potential. Each preset includes architecture-specific insights on where
              &theta; decay, caching, or model substitution has the most impact.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
