import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TickerStrip from '../../src/components/TickerStrip';
import { mockGreeks } from '../fixtures/greeks';

describe('TickerStrip', () => {
  it('renders loading state', () => {
    render(<TickerStrip models={[]} loading={true} />);

    // Verify loading text appears
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Verify loading-pulse class is applied
    const loadingElement = screen.getByText('Loading...');
    expect(loadingElement).toHaveClass('loading-pulse');
  });

  it('renders model tickers with prices', () => {
    const threeModels = mockGreeks.slice(0, 3);
    render(<TickerStrip models={threeModels} loading={false} />);

    // Verify tickers appear
    expect(screen.getAllByText('OPUS-4.5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SONNET-4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HAIKU-3.5').length).toBeGreaterThan(0);

    // Verify prices appear (multiple instances due to duplication)
    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$3.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$0.80').length).toBeGreaterThan(0);
  });

  it('renders empty state when no models', () => {
    render(<TickerStrip models={[]} loading={false} />);

    // Verify empty state message
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('duplicates items for infinite scroll', () => {
    const threeModels = mockGreeks.slice(0, 3);
    render(<TickerStrip models={threeModels} loading={false} />);

    // Each ticker should appear at least twice (duplicated array)
    const opusTickers = screen.getAllByText('OPUS-4.5');
    expect(opusTickers.length).toBeGreaterThanOrEqual(2);

    const sonnetTickers = screen.getAllByText('SONNET-4');
    expect(sonnetTickers.length).toBeGreaterThanOrEqual(2);

    const haikuTickers = screen.getAllByText('HAIKU-3.5');
    expect(haikuTickers.length).toBeGreaterThanOrEqual(2);
  });

  it('formats theta direction correctly', () => {
    const threeModels = mockGreeks.slice(0, 3);
    render(<TickerStrip models={threeModels} loading={false} />);

    // Positive theta (price declining) shows down arrow
    // OPUS-4.5 has theta=0.03 (positive), should show "↓3.0%/mo"
    expect(screen.getAllByText('↓3.0%/mo').length).toBeGreaterThan(0);

    // SONNET-4 has theta=0.02 (positive), should show "↓2.0%/mo"
    expect(screen.getAllByText('↓2.0%/mo').length).toBeGreaterThan(0);

    // HAIKU-3.5 has theta=0.01 (positive), should show "↓1.0%/mo"
    expect(screen.getAllByText('↓1.0%/mo').length).toBeGreaterThan(0);
  });

  it('renders links to model detail pages', () => {
    const threeModels = mockGreeks.slice(0, 3);
    render(<TickerStrip models={threeModels} loading={false} />);

    // Verify links exist with correct hrefs (each duplicated for scroll)
    const links = screen.getAllByRole('link');

    // Should have at least 6 links (3 models × 2 duplicates)
    expect(links.length).toBeGreaterThanOrEqual(6);

    // Verify some links have correct hrefs
    const opusLinks = links.filter((link) =>
      link.getAttribute('href')?.includes('/model/claude-opus-4.5')
    );
    expect(opusLinks.length).toBeGreaterThanOrEqual(2);
  });

  it('renders with single model', () => {
    const oneModel = [mockGreeks[0]];
    render(<TickerStrip models={oneModel} loading={false} />);

    // Verify single model appears (duplicated for scroll)
    const opusTickers = screen.getAllByText('OPUS-4.5');
    expect(opusTickers.length).toBe(2); // Exactly 2 (original + duplicate)
  });

  it('handles models without theta', () => {
    // Create model with undefined theta
    const modelWithoutTheta = {
      ...mockGreeks[0],
      theta: undefined,
    };

    render(<TickerStrip models={[modelWithoutTheta]} loading={false} />);

    // Should still render ticker and price
    expect(screen.getAllByText('OPUS-4.5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$15.00').length).toBeGreaterThan(0);

    // Theta text should be empty (formatTheta returns '' for undefined)
    // Component will still render but without theta span content
  });
});
