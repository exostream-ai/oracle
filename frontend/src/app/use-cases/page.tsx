export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-[900px] mx-auto px-4 py-12">
        <h1 className="mono text-2xl text-[#e5e5e5] mb-2">Use Cases</h1>
        <p className="text-[#737373] mb-12">
          Who uses the oracle, and why.
        </p>

        {/* AI Engineers */}
        <section className="terminal-box mb-8">
          <div className="p-4 border-b border-[#262626]">
            <h2 className="mono text-lg text-[#06b6d4]">For AI Engineers</h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
            <p>Track what you're actually spending across models.</p>
            <p>
              <span className="text-[#06b6d4]">κ</span> tells you how exposed you are to price changes — high context = high exposure.
            </p>
            <p>Forward curves show where prices are headed so you can plan migrations.</p>
            <p>Cost alerts when a cheaper model crosses below your current one.</p>
          </div>
        </section>

        {/* Finance & Procurement */}
        <section className="terminal-box mb-8">
          <div className="p-4 border-b border-[#262626]">
            <h2 className="mono text-lg text-[#06b6d4]">For Finance & Procurement Teams</h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
            <p>Budget forecasting with forward curves, not guesswork.</p>
            <p>
              The oracle publishes <span className="text-[#06b6d4]">θ</span> (decay rate) — how fast prices are falling per model.
            </p>
            <p>
              <span className="text-[#e5e5e5]">Inference Budget Planner:</span> input your monthly volume, get spot + forward cost projections.
            </p>
            <p className="text-[#525252] italic">
              "Inference costs fell 4.2% last month per the Exostream Index" — the number for your CFO.
            </p>
          </div>
        </section>

        {/* LLM Tooling Platforms */}
        <section className="terminal-box mb-8">
          <div className="p-4 border-b border-[#262626]">
            <h2 className="mono text-lg text-[#06b6d4]">For LLM Tooling Platforms</h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
            <p>Replace hardcoded price tables with a live API feed.</p>
            <p>
              <span className="text-[#e5e5e5]">Observability platforms:</span> accurate auto-updating cost tracking.
            </p>
            <p>
              <span className="text-[#e5e5e5]">Router/gateway projects:</span> real-time pricing for cost-aware routing decisions.
            </p>
            <p>One integration, all providers, always current.</p>
          </div>
        </section>

        {/* AI Analysts & Investors */}
        <section className="terminal-box mb-8">
          <div className="p-4 border-b border-[#262626]">
            <h2 className="mono text-lg text-[#06b6d4]">For AI Analysts & Investors</h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
            <p>Structured historical pricing data that doesn't exist anywhere else.</p>
            <p>
              <span className="text-[#e5e5e5]">Depreciation analytics:</span> half-life of pricing power per model generation.
            </p>
            <p>
              <span className="text-[#e5e5e5]">Provider competitive intelligence:</span> who's cutting fastest, where margins compress.
            </p>
            <p>
              The <span className="text-[#06b6d4]">Inference Cost Index</span> — a single benchmark for the market.
            </p>
          </div>
        </section>

        {/* Agentic Systems */}
        <section className="terminal-box mb-8">
          <div className="p-4 border-b border-[#262626]">
            <h2 className="mono text-lg text-[#06b6d4]">For Agentic Systems</h2>
          </div>
          <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
            <p>
              <span className="text-[#e5e5e5]">MCP server:</span> query pricing conversationally from any MCP-compatible agent.
            </p>
            <p>
              <span className="text-[#e5e5e5]">x402 integration:</span> dynamic, market-referenced pricing for machine-to-machine inference.
            </p>
            <p>
              <span className="text-[#e5e5e5]">Cost-aware routing:</span> agents that optimize spend in real-time against the oracle.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
