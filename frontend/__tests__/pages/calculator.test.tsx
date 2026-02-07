import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import CalculatorPage from '../../src/app/calculator/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/calculator',
}));

describe('Calculator Page', () => {
  it('shows loading skeleton initially', () => {
    render(<CalculatorPage />);

    // Check for loading pulse element
    const loadingElement = document.querySelector('.loading-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders CostCalculator after data loads', async () => {
    render(<CalculatorPage />);

    // Wait for Cost Calculator heading to appear
    await waitFor(() => {
      expect(screen.getByText('Cost Calculator')).toBeInTheDocument();
    });
  });

  it('renders How It Works section', async () => {
    render(<CalculatorPage />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('How It Works')).toBeInTheDocument();
    });

    // Verify kappa explanation text appears (text is split across span and p)
    expect(screen.getByText('kappa')).toBeInTheDocument();
    expect(screen.getByText(/context cost multiplier/i)).toBeInTheDocument();
    expect(screen.getByText('r_in_eff')).toBeInTheDocument();
    expect(screen.getByText(/effective input rate/i)).toBeInTheDocument();
    expect(screen.getByText('Forward cost')).toBeInTheDocument();
    expect(screen.getByText(/future date/i)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    // Override greeks handler to return 500
    server.use(
      http.get('https://api.exostream.ai/v1/greeks', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    render(<CalculatorPage />);

    // Wait for error message (after silent retry)
    await waitFor(() => {
      expect(screen.getByText(/failed to load pricing data/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Verify retry button appears
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('retry button refetches data', async () => {
    // Start with error state
    server.use(
      http.get('https://api.exostream.ai/v1/greeks', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    render(<CalculatorPage />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/failed to load pricing data/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Reset handlers to success
    server.resetHandlers();

    // Click retry button (will reload page, but in test env just re-renders)
    const retryButton = screen.getByText('Retry');

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    await userEvent.click(retryButton);

    // Verify reload was called
    expect(reloadMock).toHaveBeenCalled();
  });
});
