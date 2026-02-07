import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '@/components/Header';

describe('Header', () => {
  it('renders logo text', () => {
    render(<Header />);

    // Logo is split into two spans: "exo" + "stream"
    expect(screen.getByText('exo')).toBeInTheDocument();
    expect(screen.getByText('stream')).toBeInTheDocument();
  });

  it('renders all desktop navigation links', () => {
    render(<Header />);

    // Check all 5 navigation links exist in the document
    expect(screen.getByText('Calculator')).toBeInTheDocument();
    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(screen.getByText('Use Cases')).toBeInTheDocument();
    expect(screen.getByText('Methodology')).toBeInTheDocument();
    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('burger button has accessible label', () => {
    render(<Header />);

    const burgerButton = screen.getByRole('button', { name: 'Open menu' });
    expect(burgerButton).toBeInTheDocument();
    expect(burgerButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking burger button opens mobile menu', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const burgerButton = screen.getByRole('button', { name: 'Open menu' });

    // Initially menu is closed
    expect(burgerButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open menu
    await user.click(burgerButton);

    // aria-expanded changes to true
    expect(burgerButton).toHaveAttribute('aria-expanded', 'true');

    // Verify mobile menu links are now visible (there will be duplicates - desktop + mobile)
    const calculatorLinks = screen.getAllByText('Calculator');
    expect(calculatorLinks.length).toBeGreaterThanOrEqual(2); // desktop + mobile
  });

  it('clicking burger again closes menu', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const burgerButton = screen.getByRole('button', { name: 'Open menu' });

    // Open menu
    await user.click(burgerButton);
    expect(burgerButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();

    // Close menu
    await user.click(burgerButton);
    expect(burgerButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('clicking a mobile menu link closes the menu', async () => {
    const user = userEvent.setup();
    render(<Header />);

    const burgerButton = screen.getByRole('button', { name: 'Open menu' });

    // Open menu
    await user.click(burgerButton);
    expect(burgerButton).toHaveAttribute('aria-expanded', 'true');

    // Get all Calculator links (desktop + mobile)
    const calculatorLinks = screen.getAllByText('Calculator');
    const mobileCalculatorLink = calculatorLinks[calculatorLinks.length - 1]; // Last one is mobile

    // Click mobile menu link
    await user.click(mobileCalculatorLink);

    // Menu should close
    expect(burgerButton).toHaveAttribute('aria-expanded', 'false');
  });
});
