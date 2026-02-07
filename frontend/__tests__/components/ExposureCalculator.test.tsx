import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockGreeks } from '../fixtures/greeks';
import ExposureCalculator from '../../src/components/ExposureCalculator';

describe('ExposureCalculator', () => {
  it('renders workflow preset buttons (GSD, OpenClaw)', () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Verify workflow preset buttons exist
    expect(screen.getByText('GSD')).toBeInTheDocument();
    expect(screen.getByText('OpenClaw')).toBeInTheDocument();
  });

  it('renders business preset buttons (SaaS, Trading, Research, Content, Productivity)', () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Verify all business preset buttons exist
    expect(screen.getByText('SaaS')).toBeInTheDocument();
    expect(screen.getByText('Trading')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Productivity')).toBeInTheDocument();
  });

  it('SaaS preset is active by default', () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Verify SaaS button has active class
    const saasButton = screen.getByText('SaaS');
    expect(saasButton).toHaveClass('active');
  });

  it('renders Exposure Summary section with cost data', async () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Wait for calculations to complete
    await waitFor(() => {
      expect(screen.getByText(/Monthly Inference Cost.*C/)).toBeInTheDocument();
    });

    // Verify a dollar amount appears in the summary
    const costHeadings = screen.getAllByText(/\$/);
    expect(costHeadings.length).toBeGreaterThan(0);
  });

  it('renders kappa, theta, cost/call metrics', async () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Wait for metrics to render (text appears in multiple places)
    await waitFor(() => {
      const kappaElements = screen.getAllByText(/kappa/i);
      expect(kappaElements.length).toBeGreaterThan(0);
    });

    // Verify key metrics appear (theta appears in model breakdown and summary)
    const thetaElements = screen.getAllByText(/theta/i);
    expect(thetaElements.length).toBeGreaterThan(0);

    // Cost/call appears in summary
    expect(screen.getByText('cost/call')).toBeInTheDocument();
  });

  it('applies GSD preset on click', async () => {
    const user = userEvent.setup();
    render(<ExposureCalculator models={mockGreeks} />);

    // Initially SaaS is active
    expect(screen.getByText('SaaS')).toHaveClass('active');

    // Click GSD button
    const gsdButton = screen.getByText('GSD');
    await user.click(gsdButton);

    // Verify GSD becomes active
    await waitFor(() => {
      expect(gsdButton).toHaveClass('active');
    });
    expect(screen.getByText('SaaS')).not.toHaveClass('active');
  });

  it('renders System Architecture section for active preset', async () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Wait for architecture section to render
    await waitFor(() => {
      expect(screen.getByText('System Architecture')).toBeInTheDocument();
    });

    // Verify SaaS preset architecture description appears
    expect(screen.getByText(/AI-augmented product/i)).toBeInTheDocument();
  });

  it('renders model allocation controls', async () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Wait for model allocation section to render
    await waitFor(() => {
      expect(screen.getByText('Model Allocation')).toBeInTheDocument();
    });

    // Verify model select dropdowns exist
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);

    // Verify weight sliders exist
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('renders Optimization Levers section', async () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Wait for optimization section to render
    await waitFor(() => {
      expect(screen.getByText('Optimization Levers')).toBeInTheDocument();
    });

    // Verify at least one optimization lever is shown (ranked by savings)
    expect(screen.getByText(/Switch all to/i)).toBeInTheDocument();
  });

  it('renders Unit Economics section', async () => {
    render(<ExposureCalculator models={mockGreeks} />);

    // Wait for unit economics section to render
    await waitFor(() => {
      expect(screen.getByText('Unit Economics')).toBeInTheDocument();
    });

    // Verify key economic fields are present (use more specific text)
    expect(screen.getByText(/Revenue per task.*p/)).toBeInTheDocument();
    expect(screen.getByText(/Overhead per task.*t/)).toBeInTheDocument();
    expect(screen.getByText(/Fixed.*cost.*F/)).toBeInTheDocument();
  });

  it('handles empty model list gracefully', () => {
    render(<ExposureCalculator models={[]} />);

    // Component should render without crashing
    expect(screen.getByText('Usage Profile')).toBeInTheDocument();

    // Summary should not be rendered (no models = no calculations)
    expect(screen.queryByText(/Monthly Inference Cost/)).not.toBeInTheDocument();
  });
});
