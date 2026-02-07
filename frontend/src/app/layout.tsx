import type { Metadata } from 'next';
import '@/styles/globals.css';
import Header from '@/components/Header';
import { AppErrorBoundary } from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'Exostream - The Pricing Oracle for LLM Inference',
  description: 'Canonical price feeds, forward curves, and Greek sheets for the cost of intelligence.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AppErrorBoundary>
          <Header />

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
        </AppErrorBoundary>
      </body>
    </html>
  );
}
