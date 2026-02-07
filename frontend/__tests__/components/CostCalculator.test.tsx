import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { mockGreeks } from '../fixtures/greeks';
import { mockPriceResult } from '../fixtures/price-result';
import CostCalculator from '../../src/components/CostCalculator';

describe('CostCalculator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders preset buttons (RAG, Code Gen, Summarize)', () => {
    render(<CostCalculator models={mockGreeks} />);

    // Verify all 3 preset buttons exist
    expect(screen.getByText('RAG')).toBeInTheDocument();
    expect(screen.getByText('Code Gen')).toBeInTheDocument();
    expect(screen.getByText('Summarize')).toBeInTheDocument();
  });

  it('RAG preset is active by default', () => {
    render(<CostCalculator models={mockGreeks} />);

    // Verify RAG button has active class
    const ragButton = screen.getByText('RAG');
    expect(ragButton).toHaveClass('active');
  });

  it('renders model selector with available models', () => {
    render(<CostCalculator models={mockGreeks} />);

    // Find the select element
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Verify specific models appear as options
    expect(screen.getByRole('option', { name: /OPUS-4.5/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /SONNET-4/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /O3/ })).toBeInTheDocument();
  });

  it('renders input sliders (n_in, n_out, eta, horizon)', () => {
    render(<CostCalculator models={mockGreeks} />);

    // Check for slider labels
    expect(screen.getByText('n_in')).toBeInTheDocument();
    expect(screen.getByText('n_out')).toBeInTheDocument();
    expect(screen.getByText(/cache hit.*eta/i)).toBeInTheDocument();
    expect(screen.getByText('horizon')).toBeInTheDocument();

    // Verify sliders exist (type=range)
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(4);
  });

  it('shows pricing result after calculation', async () => {
    // Use real timers for this test to allow debounce + API call
    vi.useRealTimers();

    render(<CostCalculator models={mockGreeks} />);

    // Wait for result to appear (debounce 200ms + API call)
    await waitFor(
      () => {
        expect(screen.getByText('Spot Cost')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // Verify the spot cost value appears (0.0735 from mockPriceResult)
    expect(screen.getByText('$0.0735')).toBeInTheDocument();

    vi.useFakeTimers();
  });

  it('applies Code Gen preset on click', async () => {
    // Use real timers for user interaction
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<CostCalculator models={mockGreeks} />);

    // Initially RAG is active
    expect(screen.getByText('RAG')).toHaveClass('active');

    // Click Code Gen button
    const codeGenButton = screen.getByText('Code Gen');
    await user.click(codeGenButton);

    // Verify Code Gen becomes active
    expect(codeGenButton).toHaveClass('active');
    expect(screen.getByText('RAG')).not.toHaveClass('active');

    // Verify n_in/n_out values changed (Code Gen: n_in=5000, n_out=2000)
    // Values are displayed next to the labels
    await waitFor(() => {
      expect(screen.getByText('5K')).toBeInTheDocument(); // n_in
      expect(screen.getByText('2K')).toBeInTheDocument(); // n_out
    });

    // Restore fake timers
    vi.useFakeTimers();
  });

  it('shows n_think slider for reasoning models', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<CostCalculator models={mockGreeks} />);

    // Initially no n_think slider (OPUS-4.5 is default, non-reasoning)
    expect(screen.queryByText('n_think')).not.toBeInTheDocument();

    // Select O3 (reasoning model)
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'O3');

    // Verify n_think slider appears
    await waitFor(() => {
      expect(screen.getByText('n_think')).toBeInTheDocument();
    });

    vi.useFakeTimers();
  });

  it('hides n_think slider for non-reasoning models', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<CostCalculator models={mockGreeks} defaultModel="O3" />);

    // Wait for component to render with O3 (reasoning model)
    await waitFor(() => {
      expect(screen.getByText('n_think')).toBeInTheDocument();
    });

    // Select OPUS-4.5 (non-reasoning)
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'OPUS-4.5');

    // Verify n_think slider is removed
    await waitFor(() => {
      expect(screen.queryByText('n_think')).not.toBeInTheDocument();
    });

    vi.useFakeTimers();
  });

  it('shows error state when calculation fails', async () => {
    // Use real timers for this test
    vi.useRealTimers();

    // Override price handler to return 500
    server.use(
      http.post('https://api.exostream.ai/v1/price', () => {
        return HttpResponse.json(
          { error: 'Internal Server Error' },
          { status: 500 }
        );
      })
    );

    render(<CostCalculator models={mockGreeks} />);

    // Wait for error message to appear (debounce 200ms + API call)
    await waitFor(
      () => {
        expect(screen.getByText(/calculation failed/i)).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    vi.useFakeTimers();
  });
});
