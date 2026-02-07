'use client';

import { useState, useEffect, useRef } from 'react';
import CostCalculator from '@/components/CostCalculator';
import { getGreeks, type GreekData } from '@/lib/api';

export default function CalculatorPage() {
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
        console.error('Failed to load pricing data:', err);
        if (retryCountRef.current === 0) {
          // Silent retry on first failure
          retryCountRef.current++;
          fetchModels();
          return;
        }
        setError('Failed to load pricing data.');
      } finally {
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    retryCountRef.current = 0;
    window.location.reload();
  };

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl mono mb-2">Cost Calculator</h1>
        <p className="text-[#737373] text-sm">
          Calculate inference costs for any task profile.
        </p>
      </div>

      {loading ? (
        <div className="terminal-box p-6">
          <div className="h-64 bg-[#1a1a1a] loading-pulse" />
        </div>
      ) : error ? (
        <div className="terminal-box p-6 text-center">
          <p className="text-[#ef4444] mono mb-2">{error}</p>
          <button onClick={handleRetry} className="text-[#06b6d4] mono text-sm hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <CostCalculator models={models} />
      )}

      {/* Explanation */}
      <div className="terminal-box mt-8">
        <div className="p-4 border-b border-[#262626]">
          <h2 className="mono text-sm text-[#e5e5e5]">How It Works</h2>
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
            cost at a future date, based on the model's decay rate (theta). Prices tend to fall over time.
          </p>
        </div>
      </div>
    </div>
  );
}
