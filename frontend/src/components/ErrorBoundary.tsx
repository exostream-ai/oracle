'use client';

import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="terminal-box p-8 max-w-md w-full text-center">
        <h1 className="text-lg mono text-[#ef4444] mb-4">Something went wrong</h1>
        <p className="text-[#737373] text-sm mb-6">
          An unexpected error occurred. Please try reloading the page.
        </p>
        <button
          onClick={resetErrorBoundary}
          className="mono text-sm px-4 py-2 border border-[#06b6d4] text-[#06b6d4] hover:bg-[#06b6d4]/10 transition-colors"
        >
          Reload Page
        </button>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="mono text-xs text-[#525252] cursor-pointer hover:text-[#737373]">
              Error Details
            </summary>
            <pre className="mt-2 text-xs text-[#525252] overflow-auto max-h-48">
              {errorMessage}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reload the page when reset is called
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
