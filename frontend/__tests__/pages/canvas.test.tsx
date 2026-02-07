import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import CanvasPage from '../../src/app/canvas/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/canvas',
}));

describe('Canvas Page', () => {
  it('shows loading skeleton initially', () => {
    render(<CanvasPage />);

    // Check for loading pulse element
    const loadingElement = document.querySelector('.loading-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders ExposureCalculator after data loads', async () => {
    render(<CanvasPage />);

    // Wait for Usage Profile heading to appear (from ExposureCalculator)
    await waitFor(() => {
      expect(screen.getByText('Usage Profile')).toBeInTheDocument();
    });
  });

  it('renders System Canvas heading', async () => {
    render(<CanvasPage />);

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('System Canvas')).toBeInTheDocument();
    });

    // Verify page description appears
    expect(screen.getByText(/Model your AI cost exposure/i)).toBeInTheDocument();
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

    render(<CanvasPage />);

    // Wait for error message (after silent retry)
    await waitFor(() => {
      expect(screen.getByText(/failed to load model data/i)).toBeInTheDocument();
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

    render(<CanvasPage />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/failed to load model data/i)).toBeInTheDocument();
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
