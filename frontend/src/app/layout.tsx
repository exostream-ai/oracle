import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Exostream - The Pricing Oracle for LLM Inference',
  description: 'Canonical price feeds, forward curves, and Greek sheets for the cost of intelligence.',
  keywords: ['LLM', 'pricing', 'AI', 'inference', 'oracle', 'GPT', 'Claude', 'Gemini'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-text-primary min-h-screen">
        <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <a href="/" className="flex items-center gap-2">
                <img src="/logo.png" alt="Exostream" className="h-8 w-auto" />
                <span className="font-semibold text-lg">Exostream</span>
              </a>
              <div className="flex items-center gap-6">
                <a href="/" className="text-text-secondary hover:text-text-primary text-sm">
                  Dashboard
                </a>
                <a href="/calculator" className="text-text-secondary hover:text-text-primary text-sm">
                  Calculator
                </a>
                <a href="/methodology" className="text-text-secondary hover:text-text-primary text-sm">
                  Methodology
                </a>
                <a href="/api-docs" className="text-text-secondary hover:text-text-primary text-sm">
                  API
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="border-t border-border mt-auto py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <div className="flex items-center gap-6">
                <a href="/api-docs" className="hover:text-text-primary">API Docs</a>
                <a href="/methodology" className="hover:text-text-primary">Methodology</a>
                <a href="https://x.com/exostream" className="hover:text-text-primary" target="_blank" rel="noopener">
                  @exostream
                </a>
              </div>
              <div>
                Built by the team behind Syngraph
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
