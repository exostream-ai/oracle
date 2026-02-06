import EmbedClient from './EmbedClient';

// Generate static params for all models
export function generateStaticParams() {
  return [
    { model: 'opus-4.6' },
    { model: 'opus-4.5' },
    { model: 'sonnet-4' },
    { model: 'sonnet-3.5' },
    { model: 'haiku-3.5' },
    { model: 'gpt-4.1' },
    { model: 'gpt-4.1-mini' },
    { model: 'gpt-4.1-nano' },
    { model: 'gpt-4o' },
    { model: 'gpt-4o-mini' },
    { model: 'o3' },
    { model: 'o4-mini' },
    { model: 'gemini-2.5-pro' },
    { model: 'gemini-2.5-flash' },
    { model: 'gemini-2.0-flash' },
    { model: 'grok-4' },
    { model: 'grok-4-fast' },
    { model: 'grok-3' },
    { model: 'grok-3-mini' },
    { model: 'mistral-large' },
    { model: 'deepseek-v3' },
    { model: 'deepseek-r1' },
  ];
}

export default function EmbedPage({ params }: { params: { model: string } }) {
  return <EmbedClient modelId={params.model} />;
}
