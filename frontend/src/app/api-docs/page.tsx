export default function ApiDocsPage() {
  const baseUrl = 'https://api.exostream.ai';

  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl mono mb-2">API Documentation</h1>
        <p className="text-[#737373] text-sm">
          Free tier requires no API key. Rate limit: 60 requests/hour per IP.
        </p>
      </div>

      <div className="space-y-6">
        {/* GET /v1/spots */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <div className="flex items-center gap-3">
              <span className="mono text-xs px-2 py-1 bg-[#22c55e]/20 text-[#22c55e]">GET</span>
              <code className="mono text-[#06b6d4]">/v1/spots</code>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[#737373] text-sm mb-4">Get current spot prices for all models.</p>
            <div className="bg-[#0a0a0a] p-3 border border-[#262626] mono text-sm overflow-x-auto">
              <pre>{`curl ${baseUrl}/v1/spots`}</pre>
            </div>
          </div>
        </section>

        {/* GET /v1/greeks */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <div className="flex items-center gap-3">
              <span className="mono text-xs px-2 py-1 bg-[#22c55e]/20 text-[#22c55e]">GET</span>
              <code className="mono text-[#06b6d4]">/v1/greeks</code>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[#737373] text-sm mb-4">Get full Greek sheet for all models.</p>
            <div className="bg-[#0a0a0a] p-3 border border-[#262626] mono text-sm overflow-x-auto">
              <pre>{`curl ${baseUrl}/v1/greeks`}</pre>
            </div>
          </div>
        </section>

        {/* GET /v1/forwards/:ticker */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <div className="flex items-center gap-3">
              <span className="mono text-xs px-2 py-1 bg-[#22c55e]/20 text-[#22c55e]">GET</span>
              <code className="mono text-[#06b6d4]">/v1/forwards/:ticker</code>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[#737373] text-sm mb-4">Get forward curve for a model.</p>
            <div className="bg-[#0a0a0a] p-3 border border-[#262626] mono text-sm overflow-x-auto">
              <pre>{`curl ${baseUrl}/v1/forwards/OPUS-4.5`}</pre>
            </div>
          </div>
        </section>

        {/* POST /v1/price */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <div className="flex items-center gap-3">
              <span className="mono text-xs px-2 py-1 bg-[#06b6d4]/20 text-[#06b6d4]">POST</span>
              <code className="mono text-[#06b6d4]">/v1/price</code>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[#737373] text-sm mb-4">Calculate cost for a task profile.</p>
            <div className="bg-[#0a0a0a] p-3 border border-[#262626] mono text-sm overflow-x-auto mb-4">
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
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Description</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="mono">model</td>
                  <td>Ticker or model_id</td>
                  <td className="text-[#22c55e]">Yes</td>
                </tr>
                <tr>
                  <td className="mono">n_in</td>
                  <td>Input tokens</td>
                  <td className="text-[#22c55e]">Yes</td>
                </tr>
                <tr>
                  <td className="mono">n_out</td>
                  <td>Output tokens</td>
                  <td className="text-[#22c55e]">Yes</td>
                </tr>
                <tr>
                  <td className="mono">eta</td>
                  <td>Cache hit ratio (0-1)</td>
                  <td className="text-[#737373]">Default: 0</td>
                </tr>
                <tr>
                  <td className="mono">n_think</td>
                  <td>Thinking tokens</td>
                  <td className="text-[#737373]">Default: 0</td>
                </tr>
                <tr>
                  <td className="mono">horizon_months</td>
                  <td>Forward horizon</td>
                  <td className="text-[#737373]">Optional</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* POST /v1/compare */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <div className="flex items-center gap-3">
              <span className="mono text-xs px-2 py-1 bg-[#06b6d4]/20 text-[#06b6d4]">POST</span>
              <code className="mono text-[#06b6d4]">/v1/compare</code>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[#737373] text-sm mb-4">Compare all models for a task profile, ranked by cost.</p>
            <div className="bg-[#0a0a0a] p-3 border border-[#262626] mono text-sm overflow-x-auto">
              <pre>{`curl -X POST ${baseUrl}/v1/compare \\
  -H "Content-Type: application/json" \\
  -d '{
    "n_in": 10000,
    "n_out": 500,
    "eta": 0.4
  }'`}</pre>
            </div>
          </div>
        </section>

        {/* GET /v1/history/:ticker */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <div className="flex items-center gap-3">
              <span className="mono text-xs px-2 py-1 bg-[#22c55e]/20 text-[#22c55e]">GET</span>
              <code className="mono text-[#06b6d4]">/v1/history/:ticker</code>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[#737373] text-sm mb-4">Get price history with provenance markers.</p>
            <div className="bg-[#0a0a0a] p-3 border border-[#262626] mono text-sm overflow-x-auto">
              <pre>{`curl "${baseUrl}/v1/history/GPT-4O?from=2024-01-01"`}</pre>
            </div>
          </div>
        </section>

        {/* GET /v1/events */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <div className="flex items-center gap-3">
              <span className="mono text-xs px-2 py-1 bg-[#22c55e]/20 text-[#22c55e]">GET</span>
              <code className="mono text-[#06b6d4]">/v1/events</code>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[#737373] text-sm mb-4">Get recent price change events.</p>
            <div className="bg-[#0a0a0a] p-3 border border-[#262626] mono text-sm overflow-x-auto">
              <pre>{`curl "${baseUrl}/v1/events?since=2024-01-01"`}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
