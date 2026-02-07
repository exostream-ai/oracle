import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EmbedClient from '../../src/app/embed/[model]/EmbedClient';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/embed/claude-opus-4.5',
}));

describe('Embed Page', () => {
  it('renders EmbedTicker with modelId', async () => {
    render(<EmbedClient modelId="claude-opus-4.5" />);

    // Wait for ticker to appear
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify price is rendered
    expect(screen.getByText('$15.00')).toBeInTheDocument();
  });

  it('renders Suspense fallback while loading', () => {
    render(<EmbedClient modelId="claude-opus-4.5" />);

    // Check for loading text from Suspense fallback
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('passes default dark theme', async () => {
    render(<EmbedClient modelId="claude-opus-4.5" />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify dark theme styling (background should be dark)
    const container = screen.getByText('OPUS-4.5').closest('a');
    expect(container).toHaveStyle({ backgroundColor: '#0a0a0a' });
  });
});
