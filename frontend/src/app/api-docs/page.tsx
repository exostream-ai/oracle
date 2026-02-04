export default function ApiDocsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.exostream.ai';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">API Documentation</h1>
      <p className="text-text-secondary mb-8">
        Free tier requires no API key. Rate limit: 60 requests/hour per IP.
      </p>

      <div className="space-y-8">
        {/* Get Spots */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-positive/20 text-positive px-2 py-1 rounded text-sm font-mono">GET</span>
            <code className="text-accent">/v1/spots</code>
          </div>
          <p className="text-text-secondary mb-4">Get current spot prices for all models.</p>
          <div className="bg-surface-light rounded p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl ${baseUrl}/v1/spots`}</pre>
          </div>
        </section>

        {/* Get Greeks */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-positive/20 text-positive px-2 py-1 rounded text-sm font-mono">GET</span>
            <code className="text-accent">/v1/greeks</code>
          </div>
          <p className="text-text-secondary mb-4">Get full Greek sheet for all models.</p>
          <div className="bg-surface-light rounded p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl ${baseUrl}/v1/greeks`}</pre>
          </div>
        </section>

        {/* Get Forwards */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-positive/20 text-positive px-2 py-1 rounded text-sm font-mono">GET</span>
            <code className="text-accent">/v1/forwards/:ticker</code>
          </div>
          <p className="text-text-secondary mb-4">Get forward curve for a model.</p>
          <div className="bg-surface-light rounded p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl ${baseUrl}/v1/forwards/OPUS-4.5`}</pre>
          </div>
        </section>

        {/* Price Task */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-mono">POST</span>
            <code className="text-accent">/v1/price</code>
          </div>
          <p className="text-text-secondary mb-4">Calculate cost for a task profile.</p>
          <div className="bg-surface-light rounded p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl -X POST ${baseUrl}/v1/price \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "OPUS-4.5",
    "n_in": 30000,
    "n_out": 800,
    "eta": 0.6,
    "horizon_months": 3
  }'`}</pre>
          </div>
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Parameters</h4>
            <table className="data-table text-sm">
              <tbody>
                <tr>
                  <td className="font-mono">model</td>
                  <td>Ticker or model_id</td>
                  <td className="text-text-secondary">Required</td>
                </tr>
                <tr>
                  <td className="font-mono">n_in</td>
                  <td>Input tokens</td>
                  <td className="text-text-secondary">Required</td>
                </tr>
                <tr>
                  <td className="font-mono">n_out</td>
                  <td>Output tokens</td>
                  <td className="text-text-secondary">Required</td>
                </tr>
                <tr>
                  <td className="font-mono">eta</td>
                  <td>Cache hit ratio (0-1)</td>
                  <td className="text-text-secondary">Default: 0</td>
                </tr>
                <tr>
                  <td className="font-mono">n_think</td>
                  <td>Thinking tokens</td>
                  <td className="text-text-secondary">Default: 0</td>
                </tr>
                <tr>
                  <td className="font-mono">horizon_months</td>
                  <td>Forward horizon</td>
                  <td className="text-text-secondary">Optional</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Compare */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-accent/20 text-accent px-2 py-1 rounded text-sm font-mono">POST</span>
            <code className="text-accent">/v1/compare</code>
          </div>
          <p className="text-text-secondary mb-4">Compare all models for a task profile, ranked by cost.</p>
          <div className="bg-surface-light rounded p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl -X POST ${baseUrl}/v1/compare \\
  -H "Content-Type: application/json" \\
  -d '{
    "n_in": 10000,
    "n_out": 500,
    "eta": 0.4
  }'`}</pre>
          </div>
        </section>

        {/* History */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-positive/20 text-positive px-2 py-1 rounded text-sm font-mono">GET</span>
            <code className="text-accent">/v1/history/:ticker</code>
          </div>
          <p className="text-text-secondary mb-4">Get price history with provenance markers.</p>
          <div className="bg-surface-light rounded p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl "${baseUrl}/v1/history/GPT-4O?from=2024-01-01"`}</pre>
          </div>
        </section>

        {/* Events */}
        <section className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-positive/20 text-positive px-2 py-1 rounded text-sm font-mono">GET</span>
            <code className="text-accent">/v1/events</code>
          </div>
          <p className="text-text-secondary mb-4">Get recent price change events.</p>
          <div className="bg-surface-light rounded p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl "${baseUrl}/v1/events?since=2024-01-01"`}</pre>
          </div>
        </section>
      </div>
    </div>
  );
}
