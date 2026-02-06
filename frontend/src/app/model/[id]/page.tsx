import ModelDetailClient from './ModelDetailClient';

// Generate static params for all models at build time
export function generateStaticParams() {
  return [
    { id: 'opus-4.6' },
    { id: 'opus-4.5' },
    { id: 'sonnet-4' },
    { id: 'sonnet-3.5' },
    { id: 'haiku-3.5' },
    { id: 'gpt-4.1' },
    { id: 'gpt-4.1-mini' },
    { id: 'gpt-4.1-nano' },
    { id: 'gpt-4o' },
    { id: 'gpt-4o-mini' },
    { id: 'o3' },
    { id: 'o4-mini' },
    { id: 'gemini-2.5-pro' },
    { id: 'gemini-2.5-flash' },
    { id: 'gemini-2.0-flash' },
    { id: 'grok-4' },
    { id: 'grok-4-fast' },
    { id: 'grok-3' },
    { id: 'grok-3-mini' },
    { id: 'mistral-large' },
    { id: 'deepseek-v3' },
    { id: 'deepseek-r1' },
  ];
}

export default function ModelDetailPage({ params }: { params: { id: string } }) {
  return <ModelDetailClient modelId={params.id} />;
}
