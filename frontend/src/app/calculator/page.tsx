'use client';

import { useState, useEffect } from 'react';
import CostCalculator from '@/components/CostCalculator';
import { getGreeks, type GreekData } from '@/lib/api';

export default function CalculatorPage() {
  const [models, setModels] = useState<GreekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await getGreeks();
        setModels(response.data);
      } catch {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cost Calculator</h1>
        <p className="text-text-secondary">
          Calculate inference costs for any task profile across all tracked models.
        </p>
      </div>

      {loading ? (
        <div className="card">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-surface-light rounded w-1/3"></div>
            <div className="h-32 bg-surface-light rounded"></div>
          </div>
        </div>
      ) : (
        <CostCalculator models={models} />
      )}

      {/* Explanation */}
      <div className="mt-8 card">
        <h2 className="text-lg font-semibold mb-4">How It Works</h2>
        <div className="space-y-4 text-text-secondary text-sm">
          <p>
            <strong className="text-text-primary">κ (kappa)</strong> is your context cost multiplier.
            It tells you how many times more expensive your task is compared to pure output generation.
            A κ of 4.5 means you're 4.5× exposed to price movements.
          </p>
          <p>
            <strong className="text-text-primary">r_in_eff</strong> is the effective input rate after
            accounting for cache hits. The higher your cache hit rate (η), the lower your effective
            input cost.
          </p>
          <p>
            <strong className="text-text-primary">Forward cost</strong> projects what your task would
            cost at a future date, based on the model's decay rate (θ). Prices tend to fall over time,
            so forward costs are typically lower than spot.
          </p>
        </div>
      </div>
    </div>
  );
}
