import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ForwardCurve from '@/components/ForwardCurve';
import { mockForwards } from '../fixtures/forwards';

describe('ForwardCurve', () => {
  it('renders without crashing with valid props', () => {
    render(
      <ForwardCurve
        spot={15.0}
        forwards={mockForwards.forwards}
        theta={0.042}
        ticker="OPUS-4.5"
      />
    );

    // Component should render without errors
    expect(screen.getByText(/OPUS-4.5 Forward Curve/i)).toBeInTheDocument();
  });

  it('renders the ticker in the title', () => {
    render(
      <ForwardCurve
        spot={15.0}
        forwards={mockForwards.forwards}
        theta={0.042}
        ticker="OPUS-4.5"
      />
    );

    expect(screen.getByText('OPUS-4.5 Forward Curve')).toBeInTheDocument();
  });

  it('renders the theta display value', () => {
    render(
      <ForwardCurve
        spot={15.0}
        forwards={mockForwards.forwards}
        theta={0.042}
        ticker="OPUS-4.5"
      />
    );

    // theta is displayed as percentage per month
    expect(screen.getByText(/θ = 4.2%\/mo/i)).toBeInTheDocument();
  });

  it('renders with different ticker and theta', () => {
    render(
      <ForwardCurve
        spot={30.0}
        forwards={mockForwards.forwards}
        theta={0.056}
        ticker="GPT-4O"
      />
    );

    expect(screen.getByText('GPT-4O Forward Curve')).toBeInTheDocument();
    expect(screen.getByText(/θ = 5.6%\/mo/i)).toBeInTheDocument();
  });
});
