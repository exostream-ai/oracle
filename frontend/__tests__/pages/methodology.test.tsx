import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MethodologyPage from '@/app/methodology/page';

describe('MethodologyPage', () => {
  it('renders page heading', () => {
    render(<MethodologyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Methodology' })).toBeInTheDocument();
  });

  it('renders key section headings', () => {
    render(<MethodologyPage />);

    // Check all major section headings
    expect(screen.getByText('The Fundamental Equation')).toBeInTheDocument();
    expect(screen.getByText('Structural Greeks')).toBeInTheDocument();
    expect(screen.getByText("kappa - The Task's Delta")).toBeInTheDocument();
    expect(screen.getByText('Spot Cost')).toBeInTheDocument();
    expect(screen.getByText('Decay Rate theta')).toBeInTheDocument();
    expect(screen.getByText('Forward Price')).toBeInTheDocument();
  });

  it('renders the fundamental equation formula', () => {
    render(<MethodologyPage />);
    expect(screen.getByText('C(T, M, t) = S(T, M) * D(M, t)')).toBeInTheDocument();
  });

  it('renders the greeks table with all rows', () => {
    render(<MethodologyPage />);

    // Check for greek symbols
    expect(screen.getByText('r_in')).toBeInTheDocument();
    expect(screen.getByText('r_cache')).toBeInTheDocument();
    expect(screen.getByText('r_think')).toBeInTheDocument();
    expect(screen.getByText('r_batch')).toBeInTheDocument();

    // Check for definitions
    expect(screen.getByText('Input/output price ratio')).toBeInTheDocument();
    expect(screen.getByText('Cache price as fraction of output')).toBeInTheDocument();
    expect(screen.getByText('Thinking token price ratio')).toBeInTheDocument();
    expect(screen.getByText('Batch discount ratio')).toBeInTheDocument();
  });
});
