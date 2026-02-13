'use client';

import { useState, useEffect } from 'react';
import TickerStrip from '@/components/TickerStrip';
import TickerBoard from '@/components/TickerBoard';
import { getGreeks, type GreekData } from '@/lib/api';

export default function Home() {
  const [models, setModels] = useState<GreekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await getGreeks();
        setModels(response.data);
        setLastUpdate(new Date());
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Live Ticker Strip - full width, one line */}
      <section className="border-b border-[#262626] bg-[#141414] overflow-hidden">
        <TickerStrip models={models.slice(0, 6)} loading={loading} />
      </section>

      {/* Main Dashboard - Ticker Board */}
      <section className="py-3 px-4">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[#737373] text-xs uppercase tracking-wider mono">Live Ticker Board</h2>
            <div className="flex items-center gap-2">
              <div className="live-dot"></div>
              <span className="text-[#525252] text-xs mono">
                {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
              </span>
            </div>
          </div>

          {error ? (
            <div className="terminal-box p-4 text-center">
              <p className="text-[#ef4444] mono mb-2">{error}</p>
              <p className="text-[#525252] text-xs">
                API: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}
              </p>
            </div>
          ) : (
            <TickerBoard models={models} loading={loading} />
          )}
        </div>
      </section>

    </div>
  );
}
