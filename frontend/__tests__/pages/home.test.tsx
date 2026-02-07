import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import Home from '../../src/app/page';

// Mock next/navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

describe('Home Page', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('shows loading state initially', () => {
    render(<Home />);

    // Check for loading indicators
    const loadingElements = document.querySelectorAll('.loading-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders ticker strip with model data after fetch', async () => {
    render(<Home />);

    // Wait for data to load - verify multiple instances (strip duplicates for scroll)
    await waitFor(() => {
      const tickers = screen.getAllByText('OPUS-4.5');
      expect(tickers.length).toBeGreaterThan(0);
    });

    // Verify ticker appears in strip - should have theta direction indicator
    expect(screen.getAllByText(/↓.*%\/mo/)[0]).toBeInTheDocument();
  });

  it('renders ticker board with model data', async () => {
    render(<Home />);

    // Wait for data to load and verify table headers
    await waitFor(() => {
      expect(screen.getByText('Ticker')).toBeInTheDocument();
    });

    // Verify key column headers are present
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText(/β \(sync\)/)).toBeInTheDocument();
    expect(screen.getByText(/β \(batch\)/)).toBeInTheDocument();
    expect(screen.getByText('r_in')).toBeInTheDocument();
    expect(screen.getByText('θ')).toBeInTheDocument();
    expect(screen.getByText('σ')).toBeInTheDocument();
    expect(screen.getByText('3M Fwd')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('renders cost calculator section', async () => {
    render(<Home />);

    // Wait for data to load and verify calculator section
    await waitFor(() => {
      expect(screen.getByText('Cost Calculator')).toBeInTheDocument();
    });
  });

  it('shows error message when API fails', async () => {
    // Override handler to return 500 error
    server.use(
      http.get('https://api.exostream.ai/v1/greeks', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    render(<Home />);

    // Wait for error message to appear (from api.ts error handling)
    await waitFor(() => {
      const errorText = screen.getByText(/Internal Server Error|HTTP 500/i);
      expect(errorText).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify error box contains API URL info
    expect(screen.getByText(/API:/)).toBeInTheDocument();
  });

  it('shows update timestamp after successful fetch', async () => {
    render(<Home />);

    // Wait for data to load and verify timestamp
    await waitFor(() => {
      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });

    // Verify timestamp is displayed (should show time format like "12:34:56 PM")
    const timestamp = screen.getByText(/Updated/);
    expect(timestamp.textContent).toMatch(/Updated \d{1,2}:\d{2}:\d{2}/);
  });
});
