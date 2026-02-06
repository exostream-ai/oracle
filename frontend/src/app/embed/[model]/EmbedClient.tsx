'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EmbedTicker from '@/components/EmbedTicker';

interface EmbedClientProps {
  modelId: string;
}

function EmbedContent({ modelId }: EmbedClientProps) {
  const searchParams = useSearchParams();

  const theme = (searchParams.get('theme') as 'dark' | 'light') || 'dark';
  const showTheta = searchParams.get('theta') !== 'false';

  return (
    <EmbedTicker
      modelId={modelId}
      theme={theme}
      showTheta={showTheta}
    />
  );
}

export default function EmbedClient({ modelId }: EmbedClientProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    }}>
      <Suspense fallback={
        <div style={{
          padding: '12px 16px',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '14px',
          color: '#737373',
        }}>
          Loading...
        </div>
      }>
        <EmbedContent modelId={modelId} />
      </Suspense>
    </div>
  );
}
