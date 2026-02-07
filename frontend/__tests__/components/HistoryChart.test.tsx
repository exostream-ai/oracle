import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HistoryChart from '@/components/HistoryChart';
import { mockHistory } from '../fixtures/history';

describe('HistoryChart', () => {
  it('renders without crashing with valid props', () => {
    render(
      <HistoryChart
        prices={mockHistory.prices}
        ticker="OPUS-4.5"
      />
    );

    // Component should render without errors
    expect(screen.getByText(/OPUS-4.5 Price History/i)).toBeInTheDocument();
  });

  it('renders the ticker in the title', () => {
    render(
      <HistoryChart
        prices={mockHistory.prices}
        ticker="OPUS-4.5"
      />
    );

    expect(screen.getByText('OPUS-4.5 Price History')).toBeInTheDocument();
  });

  it('renders the reconstructed legend marker text', () => {
    render(
      <HistoryChart
        prices={mockHistory.prices}
        ticker="OPUS-4.5"
      />
    );

    // Legend shows "o reconstructed"
    expect(screen.getByText(/o reconstructed/i)).toBeInTheDocument();
  });

  it('handles empty prices array without crashing', () => {
    render(
      <HistoryChart
        prices={[]}
        ticker="OPUS-4.5"
      />
    );

    // Should still render the title even with no data
    expect(screen.getByText('OPUS-4.5 Price History')).toBeInTheDocument();
    expect(screen.getByText(/o reconstructed/i)).toBeInTheDocument();
  });

  it('renders with different ticker', () => {
    render(
      <HistoryChart
        prices={mockHistory.prices}
        ticker="GPT-4O"
      />
    );

    expect(screen.getByText('GPT-4O Price History')).toBeInTheDocument();
  });
});
