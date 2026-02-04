'use client';

import { useState, useEffect } from 'react';
import TickerStrip from '@/components/TickerStrip';
import TickerBoard from '@/components/TickerBoard';
import { getGreeks, type GreekData } from '@/lib/api';

export default function Home() {
  const [models, setModels] = useState<GreekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await getGreeks();
        setModels(response.data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <img
            src="/logo.png"
            alt="Exostream"
            className="h-16 w-auto mx-auto mb-6"
          />
          <h1 className="text-4xl font-bold mb-4">
            The pricing oracle for LLM inference
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Canonical price feeds, forward curves, and Greek sheets for every major model.
            Real-time data, no signup required.
          </p>
        </div>
      </section>

      {/* Ticker Strip */}
      <section className="border-y border-border bg-surface py-3 overflow-hidden">
        <TickerStrip models={models.slice(0, 8)} loading={loading} />
      </section>

      {/* Main Dashboard */}
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Live Ticker Board</h2>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-positive animate-pulse"></span>
              Oracle live
            </div>
          </div>

          {error ? (
            <div className="card text-center py-12">
              <p className="text-negative mb-4">{error}</p>
              <p className="text-text-secondary text-sm">
                Make sure the API is running at {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}
              </p>
            </div>
          ) : (
            <TickerBoard models={models} loading={loading} />
          )}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-text-secondary text-sm mb-1">Models Tracked</div>
              <div className="text-3xl font-mono font-semibold">{models.length}</div>
            </div>
            <div className="card">
              <div className="text-text-secondary text-sm mb-1">Providers</div>
              <div className="text-3xl font-mono font-semibold">
                {new Set(models.map(m => m.provider)).size}
              </div>
            </div>
            <div className="card">
              <div className="text-text-secondary text-sm mb-1">Cheapest Output</div>
              <div className="text-3xl font-mono font-semibold text-positive">
                ${Math.min(...models.filter(m => m.beta_sync).map(m => m.beta_sync!)).toFixed(2)}/M
              </div>
            </div>
            <div className="card">
              <div className="text-text-secondary text-sm mb-1">Premium Output</div>
              <div className="text-3xl font-mono font-semibold">
                ${Math.max(...models.filter(m => m.beta_sync).map(m => m.beta_sync!)).toFixed(2)}/M
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
