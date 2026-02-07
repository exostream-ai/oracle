import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TickerBoard from '../../src/components/TickerBoard';
import { mockGreeks } from '../fixtures/greeks';

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

describe('TickerBoard', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it('renders loading skeleton when loading=true', () => {
    render(<TickerBoard models={[]} loading={true} />);

    // Check for loading pulse elements
    const loadingElements = document.querySelectorAll('.loading-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders table with model data', () => {
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Verify each model's ticker appears
    expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    expect(screen.getByText('SONNET-4')).toBeInTheDocument();
    expect(screen.getByText('HAIKU-3.5')).toBeInTheDocument();
    expect(screen.getByText('O3')).toBeInTheDocument();
    expect(screen.getByText('GPT-4O-MINI')).toBeInTheDocument();
    expect(screen.getByText('GPT-4.1')).toBeInTheDocument();
  });

  it('renders all column headers', () => {
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Verify all column headers
    expect(screen.getByText('Ticker')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText(/β \(sync\)/)).toBeInTheDocument();
    expect(screen.getByText(/β \(batch\)/)).toBeInTheDocument();
    expect(screen.getByText('r_in')).toBeInTheDocument();
    expect(screen.getByText('θ')).toBeInTheDocument();
    expect(screen.getByText('σ')).toBeInTheDocument();
    expect(screen.getByText('3M Fwd')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('sorts by beta_sync ascending by default', () => {
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Get all table rows (skip header)
    const rows = screen.getAllByRole('row').slice(1);

    // First row should have lowest beta_sync model (GPT-4O-MINI at 0.15)
    expect(rows[0]).toHaveTextContent('GPT-4O-MINI');
  });

  it('toggles sort direction when clicking same header', async () => {
    const user = userEvent.setup();
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Initial order: ascending (GPT-4O-MINI first with 0.15)
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('GPT-4O-MINI');

    // Click beta sync header to toggle to descending
    const betaSyncHeader = screen.getByText(/β \(sync\)/);
    await user.click(betaSyncHeader);

    // Order should reverse: highest first (OPUS-4.5 with 15.0)
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('OPUS-4.5');
  });

  it('changes sort column when clicking different header', async () => {
    const user = userEvent.setup();
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Initially sorted by beta_sync (GPT-4O-MINI first)
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('GPT-4O-MINI');

    // Click Provider header for alphabetical sort
    const providerHeader = screen.getByText('Provider');
    await user.click(providerHeader);

    // Should now be sorted by provider alphabetically (Anthropic first)
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Anthropic');
  });

  it('navigates to model detail on row click', async () => {
    const user = userEvent.setup();
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Get all table rows (skip header)
    const rows = screen.getAllByRole('row').slice(1);

    // Click first row (should be GPT-4O-MINI based on default sort)
    await user.click(rows[0]);

    // Verify router.push was called with correct model_id
    expect(pushMock).toHaveBeenCalledWith('/model/gpt-4o-mini');
  });

  it('formats theta correctly', () => {
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Positive theta (0.03) should show negative percentage (price declining)
    // OPUS-4.5 has theta=0.03, should display as "-3.0%"
    expect(screen.getByText('-3.0%')).toBeInTheDocument();

    // Find the cell with theta to verify it's formatted correctly
    // All test models have positive theta, so all should show negative percentages
    const thetaCells = screen.getAllByText(/-\d+\.\d+%/);
    expect(thetaCells.length).toBeGreaterThan(0);
  });

  it('renders empty table when no models', () => {
    render(<TickerBoard models={[]} loading={false} />);

    // Verify table renders with headers
    expect(screen.getByText('Ticker')).toBeInTheDocument();
    expect(screen.getByText('Provider')).toBeInTheDocument();

    // Verify no data rows exist (only header row)
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(1); // Only header row
  });

  it('displays providers correctly', () => {
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Verify provider names appear
    expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
  });

  it('formats sigma as percentage', () => {
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // OPUS-4.5 has sigma=0.15, should display as "15.0%"
    expect(screen.getByText('15.0%')).toBeInTheDocument();

    // SONNET-4 has sigma=0.12, should display as "12.0%"
    expect(screen.getByText('12.0%')).toBeInTheDocument();
  });

  it('calculates and displays 3M forward prices', () => {
    render(<TickerBoard models={mockGreeks} loading={false} />);

    // Verify forward prices are displayed (format: $X.XX)
    // All models should have forward prices calculated
    const forwardPrices = screen.getAllByText(/\$\d+\.\d{2}/);

    // Should have forward prices for all 6 models plus beta_sync prices
    expect(forwardPrices.length).toBeGreaterThan(6);
  });
});
