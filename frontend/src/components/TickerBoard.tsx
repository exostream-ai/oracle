'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type GreekData } from '@/lib/api';

interface TickerBoardProps {
  models: GreekData[];
  loading: boolean;
}

type SortKey = 'ticker' | 'provider' | 'beta_sync' | 'beta_batch' | 'r_in' | 'theta' | 'sigma' | 'forward';

function formatPrice(price?: number): string {
  if (price === undefined) return '-';
  return `$${price.toFixed(2)}`;
}

function formatTheta(theta?: number): string {
  if (theta === undefined) return '-';
  const pct = Math.abs(theta * 100).toFixed(1);
  return theta > 0 ? `-${pct}%` : `+${pct}%`;
}

function formatContext(w: number): string {
  if (w >= 1000000) return `${(w / 1000000).toFixed(1)}M`;
  return `${(w / 1000).toFixed(0)}K`;
}

export default function TickerBoard({ models, loading }: TickerBoardProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('beta_sync');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedModels = [...models].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortKey) {
      case 'ticker':
        aVal = a.ticker;
        bVal = b.ticker;
        break;
      case 'provider':
        aVal = a.provider;
        bVal = b.provider;
        break;
      case 'beta_sync':
        aVal = a.beta_sync ?? 999999;
        bVal = b.beta_sync ?? 999999;
        break;
      case 'beta_batch':
        aVal = a.beta_batch ?? 999999;
        bVal = b.beta_batch ?? 999999;
        break;
      case 'r_in':
        aVal = a.r_in;
        bVal = b.r_in;
        break;
      case 'theta':
        aVal = a.theta ?? 0;
        bVal = b.theta ?? 0;
        break;
      case 'sigma':
        aVal = a.sigma ?? 0;
        bVal = b.sigma ?? 0;
        break;
      case 'forward':
        aVal = (a.beta_sync ?? 0) * Math.exp(-(a.theta ?? 0) * 3);
        bVal = (b.beta_sync ?? 0) * Math.exp(-(b.theta ?? 0) * 3);
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortHeader = ({ label, keyName }: { label: string; keyName: SortKey }) => (
    <th
      onClick={() => handleSort(keyName)}
      className={sortKey === keyName ? 'sorted' : ''}
    >
      {label}
      {sortKey === keyName && (
        <span className="ml-1 text-[10px]">{sortAsc ? '▲' : '▼'}</span>
      )}
    </th>
  );

  if (loading) {
    return (
      <div className="terminal-box">
        <div className="p-4 space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 bg-[#1a1a1a] loading-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-box overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader label="Ticker" keyName="ticker" />
            <SortHeader label="Provider" keyName="provider" />
            <SortHeader label="β (sync)" keyName="beta_sync" />
            <SortHeader label="β (batch)" keyName="beta_batch" />
            <SortHeader label="r_in" keyName="r_in" />
            <SortHeader label="θ" keyName="theta" />
            <SortHeader label="σ" keyName="sigma" />
            <SortHeader label="3M Fwd" keyName="forward" />
            <th>W</th>
          </tr>
        </thead>
        <tbody>
          {sortedModels.map((model) => {
            const forward3m = model.beta_sync && model.theta !== undefined
              ? model.beta_sync * Math.exp(-model.theta * 3)
              : undefined;

            return (
              <tr
                key={model.model_id}
                onClick={() => router.push(`/model/${model.model_id}`)}
              >
                <td>
                  <span className="text-[#06b6d4] font-medium">{model.ticker}</span>
                </td>
                <td className="text-[#737373]">{model.provider}</td>
                <td>{formatPrice(model.beta_sync)}</td>
                <td className="text-[#737373]">{formatPrice(model.beta_batch)}</td>
                <td className="text-[#737373]">{model.r_in.toFixed(3)}</td>
                <td className={model.theta && model.theta > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
                  {formatTheta(model.theta)}
                </td>
                <td className="text-[#737373]">
                  {model.sigma !== undefined ? `${(model.sigma * 100).toFixed(1)}%` : '-'}
                </td>
                <td>{formatPrice(forward3m)}</td>
                <td className="text-[#737373]">{formatContext(model.context_window)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
