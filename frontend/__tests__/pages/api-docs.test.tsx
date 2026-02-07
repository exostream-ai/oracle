import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ApiDocsPage from '@/app/api-docs/page';

describe('ApiDocsPage', () => {
  it('renders page heading', () => {
    render(<ApiDocsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'API Documentation' })).toBeInTheDocument();
  });

  it('renders rate limit information', () => {
    render(<ApiDocsPage />);
    expect(screen.getByText(/60 requests\/hour/i)).toBeInTheDocument();
  });

  it('renders all endpoint paths', () => {
    render(<ApiDocsPage />);

    // Check for all endpoint paths
    expect(screen.getByText('/v1/spots')).toBeInTheDocument();
    expect(screen.getByText('/v1/greeks')).toBeInTheDocument();
    expect(screen.getByText('/v1/forwards/:ticker')).toBeInTheDocument();
    expect(screen.getByText('/v1/price')).toBeInTheDocument();
    expect(screen.getByText('/v1/compare')).toBeInTheDocument();
    expect(screen.getByText('/v1/history/:ticker')).toBeInTheDocument();
    expect(screen.getByText('/v1/events')).toBeInTheDocument();
  });

  it('renders HTTP method badges', () => {
    render(<ApiDocsPage />);

    // Check for GET badges (should be multiple)
    const getBadges = screen.getAllByText('GET');
    expect(getBadges.length).toBeGreaterThan(0);

    // Check for POST badges
    const postBadges = screen.getAllByText('POST');
    expect(postBadges.length).toBe(2); // /v1/price and /v1/compare
  });

  it('renders endpoint descriptions', () => {
    render(<ApiDocsPage />);

    expect(screen.getByText('Get current spot prices for all models.')).toBeInTheDocument();
    expect(screen.getByText('Get full Greek sheet for all models.')).toBeInTheDocument();
    expect(screen.getByText('Get forward curve for a model.')).toBeInTheDocument();
    expect(screen.getByText('Calculate cost for a task profile.')).toBeInTheDocument();
  });

  it('renders request parameter table for /v1/price', () => {
    render(<ApiDocsPage />);

    // Check for parameter names in the table
    expect(screen.getByText(/^model$/)).toBeInTheDocument();
    expect(screen.getByText(/^n_in$/)).toBeInTheDocument();
    expect(screen.getByText(/^n_out$/)).toBeInTheDocument();
    expect(screen.getByText(/^eta$/)).toBeInTheDocument();
    expect(screen.getByText(/^n_think$/)).toBeInTheDocument();
    expect(screen.getByText(/^horizon_months$/)).toBeInTheDocument();
  });
});
