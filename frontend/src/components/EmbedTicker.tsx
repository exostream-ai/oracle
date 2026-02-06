'use client';

import { useEffect, useState } from 'react';

interface TickerData {
  model_id: string;
  ticker: string;
  beta_sync: number;
  theta: number;
}

interface EmbedTickerProps {
  modelId: string;
  theme?: 'dark' | 'light';
  showTheta?: boolean;
}

function formatPrice(price?: number): string {
  if (price === undefined) return '-';
  return `$${price.toFixed(2)}`;
}

function formatTheta(theta?: number): string {
  if (theta === undefined) return '';
  const pct = Math.abs(theta * 100).toFixed(1);
  return theta > 0 ? `${pct}%/mo` : `+${pct}%/mo`;
}

export default function EmbedTicker({ modelId, theme = 'dark', showTheta = true }: EmbedTickerProps) {
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.exostream.ai';

    fetch(`${apiBase}/v1/greeks/${modelId}`)
      .then(res => {
        if (!res.ok) throw new Error('Model not found');
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [modelId]);

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0a0a0a' : '#ffffff';
  const textColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#737373' : '#a3a3a3';
  const accentColor = '#06b6d4';
  const greenColor = '#22c55e';
  const redColor = '#ef4444';

  if (loading) {
    return (
      <div style={{
        backgroundColor: bgColor,
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '14px',
        color: mutedColor,
        display: 'inline-block',
      }}>
        Loading...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        backgroundColor: bgColor,
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '14px',
        color: redColor,
        display: 'inline-block',
      }}>
        {error || 'Error loading data'}
      </div>
    );
  }

  const thetaColor = data.theta > 0 ? greenColor : redColor;
  const thetaArrow = data.theta > 0 ? '↓' : '↑';

  return (
    <a
      href={`https://exostream.ai/model/${modelId}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        backgroundColor: bgColor,
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        textDecoration: 'none',
        border: isDark ? '1px solid #262626' : '1px solid #e5e5e5',
        transition: 'border-color 0.2s',
      }}
    >
      <span style={{ color: accentColor, fontWeight: 600 }}>
        {data.ticker}
      </span>
      <span style={{ color: textColor }}>
        {formatPrice(data.beta_sync)}
      </span>
      {showTheta && data.theta !== undefined && (
        <span style={{ color: thetaColor, fontSize: '12px' }}>
          {thetaArrow}{formatTheta(data.theta)}
        </span>
      )}
      <span style={{ color: mutedColor, fontSize: '10px' }}>
        exostream.ai
      </span>
    </a>
  );
}
