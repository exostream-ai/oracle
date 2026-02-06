'use client';

import { useState, useEffect } from 'react';
import ExposureCalculator from '@/components/ExposureCalculator';
import { getGreeks, type GreekData } from '@/lib/api';

export default function CanvasPage() {
  const [models, setModels] = useState<GreekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await getGreeks();
        setModels(response.data);
      } catch {}
      finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl mono mb-2">System Canvas</h1>
        <p className="text-[#737373] text-sm">
          Model your AI cost exposure and unit economics. Pick a workflow or business archetype,
          see system architecture, inference costs, profit margins, and optimization levers.
        </p>
      </div>

      {loading ? (
        <div className="terminal-box p-6">
          <div className="h-96 bg-[#1a1a1a] loading-pulse" />
        </div>
      ) : (
        <ExposureCalculator models={models} />
      )}

      {/* Methodology */}
      <div className="terminal-box mt-8">
        <div className="p-4 border-b border-[#262626]">
          <h2 className="mono text-sm text-[#e5e5e5]">How It Works</h2>
        </div>
        <div className="p-4 space-y-4 text-[#737373] text-sm">
          <p>
            <span className="mono text-[#e5e5e5]">Inference Cost (C)</span> is computed as:
            monthly calls &times; blended cost per call, weighted by model mix and task distribution.
            Cost per call uses the Exostream pricing model: S = &beta; &times; (n_out + n_in &times; r_in_eff) &times; 10&sup-6;.
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
    </div>
  );
}
