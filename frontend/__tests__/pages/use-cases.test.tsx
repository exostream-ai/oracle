import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UseCasesPage from '@/app/use-cases/page';

describe('UseCasesPage', () => {
  it('renders page heading', () => {
    render(<UseCasesPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Use Cases' })).toBeInTheDocument();
  });

  it('renders all section headings', () => {
    render(<UseCasesPage />);

    // Check all 5 use case section headings
    expect(screen.getByText('For AI Engineers')).toBeInTheDocument();
    expect(screen.getByText('For Finance & Procurement Teams')).toBeInTheDocument();
    expect(screen.getByText('For LLM Tooling Platforms')).toBeInTheDocument();
    expect(screen.getByText('For AI Analysts & Investors')).toBeInTheDocument();
    expect(screen.getByText('For Agentic Systems')).toBeInTheDocument();
  });

  it('renders key content for AI Engineers', () => {
    render(<UseCasesPage />);

    expect(screen.getByText(/Track what you're actually spending/i)).toBeInTheDocument();
    expect(screen.getByText(/Forward curves show where prices are headed/i)).toBeInTheDocument();
  });

  it('renders key content for Finance teams', () => {
    render(<UseCasesPage />);

    expect(screen.getByText(/Budget forecasting with forward curves/i)).toBeInTheDocument();
    expect(screen.getByText(/Inference Budget Planner/i)).toBeInTheDocument();
  });

  it('renders key content for Agentic Systems', () => {
    render(<UseCasesPage />);

    expect(screen.getByText(/MCP server:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cost-aware routing:/i)).toBeInTheDocument();
  });
});
