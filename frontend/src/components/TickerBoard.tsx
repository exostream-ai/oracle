'use client';

import { useState } from 'react';
import { formatPrice, formatTheta, formatPercent, formatNumber, type GreekData } from '@/lib/api';

interface TickerBoardProps {
  models: GreekData[];
  loading: boolean;
}

type SortKey = 'ticker' | 'provider' | 'beta_sync' | 'beta_batch' | 'r_in' | 'theta' | 'sigma' | 'forward';

export default function TickerBoard({ models, loading }: TickerBoardProps) {
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
        // 3M forward approximation
        aVal = (a.beta_sync ?? 0) * Math.exp(-(a.theta ?? 0) * 3);
        bVal = (b.beta_sync ?? 0) * Math.exp(-(b.theta ?? 0) * 3);
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th
      onClick={() => handleSort(sortKeyName)}
      className={`cursor-pointer hover:text-text-primary ${sortKey === sortKeyName ? 'text-accent' : ''}`}
    >
      {label}
      {sortKey === sortKeyName && (
        <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
      )}
    </th>
  );

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-surface-light rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <SortHeader label="Ticker" sortKeyName="ticker" />
            <SortHeader label="Provider" sortKeyName="provider" />
            <SortHeader label="β (Sync)" sortKeyName="beta_sync" />
            <SortHeader label="β (Batch)" sortKeyName="beta_batch" />
            <SortHeader label="r_in" sortKeyName="r_in" />
            <SortHeader label="θ" sortKeyName="theta" />
            <SortHeader label="σ" sortKeyName="sigma" />
            <SortHeader label="3M Forward" sortKeyName="forward" />
            <th>Context</th>
          </tr>
        </thead>
        <tbody>
          {sortedModels.map((model) => {
            const forward3m = model.beta_sync && model.theta !== undefined
              ? model.beta_sync * Math.exp(-model.theta * 3)
              : undefined;

            return (
              <tr key={model.model_id}>
                <td>
                  <a
                    href={`/model/${model.model_id}`}
                    className="text-accent hover:underline font-semibold"
                  >
                    {model.ticker}
                  </a>
                </td>
                <td className="text-text-secondary">{model.provider}</td>
                <td>{formatPrice(model.beta_sync)}/M</td>
                <td className="text-text-secondary">
                  {model.beta_batch ? `${formatPrice(model.beta_batch)}/M` : '-'}
                </td>
                <td className="text-text-secondary">{model.r_in.toFixed(3)}</td>
                <td className={model.theta && model.theta > 0 ? 'text-negative' : 'text-positive'}>
                  {formatTheta(model.theta)}
                </td>
                <td className="text-text-secondary">
                  {model.sigma !== undefined ? `${(model.sigma * 100).toFixed(1)}%` : '-'}
                </td>
                <td>{forward3m !== undefined ? formatPrice(forward3m) : '-'}</td>
                <td className="text-text-secondary">{formatNumber(model.context_window)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
