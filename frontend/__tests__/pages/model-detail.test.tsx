import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import ModelDetailClient from '../../src/app/model/[id]/ModelDetailClient';
import { mockGreeks } from '../fixtures/greeks';
import { mockForwards } from '../fixtures/forwards';
import { mockHistory } from '../fixtures/history';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/model/opus-4.5',
}));

describe('Model Detail Page', () => {
  it('shows loading skeleton initially', () => {
    render(<ModelDetailClient modelId="claude-opus-4.5" />);

    // Check for loading indicators
    const loadingElements = document.querySelectorAll('.loading-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders model detail after data loads', async () => {
    render(<ModelDetailClient modelId="claude-opus-4.5" />);

    // Wait for model ticker to appear
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify provider appears
    expect(screen.getByText('Anthropic')).toBeInTheDocument();

    // Verify quick stats section with beta (sync), beta (batch), theta, context
    expect(screen.getByText('beta (sync)')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('beta (batch)')).toBeInTheDocument();
    // "theta" appears multiple times (quick stats + greek sheet), so use getAllByText
    const thetaLabels = screen.getAllByText('theta');
    expect(thetaLabels.length).toBeGreaterThan(0);
    expect(screen.getByText('context')).toBeInTheDocument();
    expect(screen.getByText('200K')).toBeInTheDocument();

    // Verify Greek sheet section appears
    expect(screen.getByText('Greek Sheet')).toBeInTheDocument();
    expect(screen.getByText('r_in')).toBeInTheDocument();
    expect(screen.getByText('r_cache')).toBeInTheDocument();
  });

  it('renders forward curve chart when forwards data loads', async () => {
    render(<ModelDetailClient modelId="claude-opus-4.5" />);

    // Wait for data to load and verify Forward Curve heading appears (with ticker prefix)
    await waitFor(() => {
      expect(screen.getByText(/Forward Curve/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('renders price history chart when history data loads', async () => {
    render(<ModelDetailClient modelId="claude-opus-4.5" />);

    // Wait for data to load and verify Price History heading appears (with ticker prefix)
    await waitFor(() => {
      expect(screen.getByText(/Price History/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows "Model not found" for invalid model ID', async () => {
    render(<ModelDetailClient modelId="nonexistent-model" />);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Model not found')).toBeInTheDocument();
    });

    // Verify "Back to Dashboard" link appears
    const backLink = screen.getByText('Back to Dashboard');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });

  it('shows error when greeks API fails', async () => {
    // Override handler to return 500 error
    server.use(
      http.get('https://api.exostream.ai/v1/greeks', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    render(<ModelDetailClient modelId="claude-opus-4.5" />);

    // Wait for error message to appear
    await waitFor(() => {
      const errorText = screen.getByText(/Internal Server Error|HTTP 500/i);
      expect(errorText).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify "Back to Dashboard" link appears on error
    const backLink = screen.getByText('Back to Dashboard');
    expect(backLink).toBeInTheDocument();
  });

  it('shows inline error when forwards sub-fetch fails', async () => {
    // Override forwards handler to return 500 error
    server.use(
      http.get('https://api.exostream.ai/v1/forwards/:ticker', () => {
        return HttpResponse.json(
          { error: 'Forwards fetch failed' },
          { status: 500 }
        );
      })
    );

    render(<ModelDetailClient modelId="claude-opus-4.5" />);

    // Wait for model data to load (model should still render)
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify the forwards error message appears inline
    await waitFor(() => {
      expect(screen.getByText('Failed to load forward curve.')).toBeInTheDocument();
    });

    // Verify the rest of the page still renders (Greek sheet should be visible)
    expect(screen.getByText('Greek Sheet')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('shows inline error when history sub-fetch fails', async () => {
    // Override history handler to return 500 error
    server.use(
      http.get('https://api.exostream.ai/v1/history/:ticker', () => {
        return HttpResponse.json(
          { error: 'History fetch failed' },
          { status: 500 }
        );
      })
    );

    render(<ModelDetailClient modelId="claude-opus-4.5" />);

    // Wait for model data to load (model should still render)
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify the history error message appears inline
    await waitFor(() => {
      expect(screen.getByText('Failed to load price history.')).toBeInTheDocument();
    });

    // Verify the rest of the page still renders (Greek sheet should be visible)
    expect(screen.getByText('Greek Sheet')).toBeInTheDocument();
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('renders reasoning badge for reasoning models', async () => {
    render(<ModelDetailClient modelId="o3" />);

    // Wait for model data to load
    await waitFor(() => {
      expect(screen.getByText('O3')).toBeInTheDocument();
    });

    // Verify reasoning badge appears
    expect(screen.getByText('reasoning')).toBeInTheDocument();
  });

  it('renders "Back to Dashboard" link on error', async () => {
    render(<ModelDetailClient modelId="nonexistent-model" />);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Model not found')).toBeInTheDocument();
    });

    // Verify link exists and has correct href
    const backLink = screen.getByText('Back to Dashboard');
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });
});
