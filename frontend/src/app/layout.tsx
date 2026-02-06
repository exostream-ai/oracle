import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Exostream - The Pricing Oracle for LLM Inference',
  description: 'Canonical price feeds, forward curves, and Greek sheets for the cost of intelligence.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        {/* Header - logo left, nav right */}
        <header className="border-b border-[#262626] bg-[#0a0a0a]">
          <div className="max-w-[1400px] mx-auto px-4 h-12 flex items-center justify-between">
            <a href="/" className="flex items-center">
              <span className="mono text-lg font-semibold">
                <span className="text-[#e5e5e5]">exo</span>
                <span className="text-[#06b6d4]">stream</span>
              </span>
            </a>
            <nav className="flex items-center gap-6">
              <a href="/#calculator" className="text-[#737373] hover:text-[#e5e5e5] text-sm mono">
                Calculator
              </a>
              <a href="/canvas" className="text-[#737373] hover:text-[#e5e5e5] text-sm mono">
                Canvas
              </a>
              <a href="/use-cases" className="text-[#737373] hover:text-[#e5e5e5] text-sm mono">
                Use Cases
              </a>
              <a href="/methodology" className="text-[#737373] hover:text-[#e5e5e5] text-sm mono">
                Methodology
              </a>
              <a href="/api-docs" className="text-[#737373] hover:text-[#e5e5e5] text-sm mono">
                API
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Footer - minimal */}
        <footer className="border-t border-[#262626] py-3 mt-auto">
          <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-6 text-xs text-[#737373] mono">
              <a href="/use-cases" className="hover:text-[#e5e5e5]">Use Cases</a>
              <a href="/api-docs" className="hover:text-[#e5e5e5]">API Docs</a>
              <a href="/methodology" className="hover:text-[#e5e5e5]">Methodology</a>
              <a href="https://x.com/exostream" target="_blank" rel="noopener" className="hover:text-[#e5e5e5]">
                @exostream
              </a>
            </div>
            <div className="text-xs text-[#525252]">
              Built by the team behind Syngraph
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
