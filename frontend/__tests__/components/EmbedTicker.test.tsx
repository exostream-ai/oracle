import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import EmbedTicker from '../../src/components/EmbedTicker';

describe('EmbedTicker Component', () => {
  beforeEach(() => {
    // Reset handlers before each test
    server.resetHandlers();
  });

  it('shows loading state initially', () => {
    render(<EmbedTicker modelId="claude-opus-4.5" />);

    // Check for loading text
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders ticker with price after fetch', async () => {
    render(<EmbedTicker modelId="claude-opus-4.5" />);

    // Wait for ticker to appear
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify price appears
    expect(screen.getByText('$15.00')).toBeInTheDocument();
  });

  it('renders theta with down arrow for positive theta', async () => {
    render(<EmbedTicker modelId="claude-opus-4.5" />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify theta display with down arrow (positive theta = depreciation)
    const thetaText = screen.getByText(/↓.*3.0%\/mo/);
    expect(thetaText).toBeInTheDocument();
  });

  it('renders exostream.ai attribution', async () => {
    render(<EmbedTicker modelId="claude-opus-4.5" />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify attribution appears
    expect(screen.getByText('exostream.ai')).toBeInTheDocument();
  });

  it('shows error for invalid model', async () => {
    // Override handler to return 404 error
    server.use(
      http.get('https://api.exostream.ai/v1/greeks/:ticker', () => {
        return HttpResponse.json(
          { error: 'Model not found' },
          { status: 404 }
        );
      })
    );

    render(<EmbedTicker modelId="nonexistent-model" />);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Model not found')).toBeInTheDocument();
    });
  });

  it('links to model page on exostream.ai', async () => {
    render(<EmbedTicker modelId="claude-opus-4.5" />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify the link has correct href
    const link = screen.getByText('OPUS-4.5').closest('a');
    expect(link).toHaveAttribute('href', 'https://exostream.ai/model/claude-opus-4.5');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('respects theme prop', async () => {
    render(<EmbedTicker modelId="claude-opus-4.5" theme="light" />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify light theme styling (background color should be white)
    const container = screen.getByText('OPUS-4.5').closest('a');
    expect(container).toHaveStyle({ backgroundColor: '#ffffff' });
  });

  it('hides theta when showTheta=false', async () => {
    render(<EmbedTicker modelId="claude-opus-4.5" showTheta={false} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    });

    // Verify theta text is NOT present
    expect(screen.queryByText(/↓.*%\/mo/)).not.toBeInTheDocument();

    // But ticker and price should still be present
    expect(screen.getByText('OPUS-4.5')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
  });
});
