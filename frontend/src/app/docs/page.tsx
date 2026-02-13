'use client';

import { useState, useEffect } from 'react';

const SECTIONS = [
  { id: 'use-cases', label: 'Use Cases' },
  { id: 'methodology', label: 'Methodology' },
  { id: 'calculator-guide', label: 'Calculator Guide' },
  { id: 'api', label: 'API Reference' },
] as const;

export default function DocsPage() {
  const [active, setActive] = useState('use-cases');

  // Handle hash navigation on mount and hash change
  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash.replace('#', '');
      if (hash && SECTIONS.some(s => s.id === hash)) {
        setActive(hash);
      }
    }
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const scrollToSection = (id: string) => {
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const baseUrl = 'https://api.exostream.ai';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-[1200px] mx-auto px-4 py-8 flex gap-8">

        {/* ── Left sidebar ──────────────────────────────────── */}
        <nav className="hidden md:block w-48 shrink-0 sticky top-20 self-start">
          <div className="text-[#525252] text-xs mono uppercase tracking-wider mb-3">Contents</div>
          <div className="space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`block w-full text-left px-3 py-1.5 text-sm mono transition-colors ${
                  active === s.id
                    ? 'text-[#06b6d4] border-l-2 border-[#06b6d4] bg-[#06b6d4]/5'
                    : 'text-[#737373] hover:text-[#e5e5e5] border-l-2 border-transparent'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Mobile section selector ───────────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a] border-t border-[#262626] px-2 py-2 flex gap-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`flex-1 text-center py-2 text-xs mono rounded ${
                active === s.id
                  ? 'text-[#06b6d4] bg-[#06b6d4]/10'
                  : 'text-[#737373]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Main content ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-16 pb-20 md:pb-8">

          {/* ═══════════════════════════════════════════════════
              USE CASES
              ═══════════════════════════════════════════════════ */}
          <section id="use-cases">
            <h1 className="mono text-2xl text-[#e5e5e5] mb-2">Use Cases</h1>
            <p className="text-[#737373] mb-8">Who uses the oracle, and why.</p>

            {/* AI Engineers */}
            <div className="terminal-box mb-6">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-lg text-[#06b6d4]">For AI Engineers</h2>
              </div>
              <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
                <p>Track what you&apos;re actually spending across models.</p>
                <p><span className="text-[#06b6d4]">&kappa;</span> tells you how exposed you are to price changes &mdash; high context = high exposure.</p>
                <p>Forward curves show where prices are headed so you can plan migrations.</p>
                <p>Cost alerts when a cheaper model crosses below your current one.</p>
              </div>
            </div>

            {/* Finance & Procurement */}
            <div className="terminal-box mb-6">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-lg text-[#06b6d4]">For Finance &amp; Procurement Teams</h2>
              </div>
              <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
                <p>Budget forecasting with forward curves, not guesswork.</p>
                <p>The oracle publishes <span className="text-[#06b6d4]">&theta;</span> (decay rate) &mdash; how fast prices are falling per model.</p>
                <p><span className="text-[#e5e5e5]">Inference Budget Planner:</span> input your monthly volume, get spot + forward cost projections.</p>
                <p className="text-[#525252] italic">&quot;Inference costs fell 4.2% last month per the Exostream Index&quot; &mdash; the number for your CFO.</p>
              </div>
            </div>

            {/* LLM Tooling Platforms */}
            <div className="terminal-box mb-6">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-lg text-[#06b6d4]">For LLM Tooling Platforms</h2>
              </div>
              <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
                <p>Replace hardcoded price tables with a live API feed.</p>
                <p><span className="text-[#e5e5e5]">Observability platforms:</span> accurate auto-updating cost tracking.</p>
                <p><span className="text-[#e5e5e5]">Router/gateway projects:</span> real-time pricing for cost-aware routing decisions.</p>
                <p>One integration, all providers, always current.</p>
              </div>
            </div>

            {/* AI Analysts & Investors */}
            <div className="terminal-box mb-6">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-lg text-[#06b6d4]">For AI Analysts &amp; Investors</h2>
              </div>
              <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
                <p>Structured historical pricing data that doesn&apos;t exist anywhere else.</p>
                <p><span className="text-[#e5e5e5]">Depreciation analytics:</span> half-life of pricing power per model generation.</p>
                <p><span className="text-[#e5e5e5]">Provider competitive intelligence:</span> who&apos;s cutting fastest, where margins compress.</p>
                <p>The <span className="text-[#06b6d4]">Inference Cost Index</span> &mdash; a single benchmark for the market.</p>
              </div>
            </div>

            {/* Agentic Systems */}
            <div className="terminal-box">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-lg text-[#06b6d4]">For Agentic Systems</h2>
              </div>
              <div className="p-4 space-y-3 text-sm text-[#a3a3a3]">
                <p><span className="text-[#e5e5e5]">MCP server:</span> query pricing conversationally from any MCP-compatible agent.</p>
                <p><span className="text-[#e5e5e5]">x402 integration:</span> dynamic, market-referenced pricing for machine-to-machine inference.</p>
                <p><span className="text-[#e5e5e5]">Cost-aware routing:</span> agents that optimize spend in real-time against the oracle.</p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════
              METHODOLOGY
              ═══════════════════════════════════════════════════ */}
          <section id="methodology">
            <h1 className="mono text-2xl text-[#e5e5e5] mb-2">Methodology</h1>

            {/* Plain-English intro */}
            <div className="terminal-box mb-8">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-sm text-[#06b6d4]">Why This Matters</h2>
              </div>
              <div className="p-4 space-y-4 text-sm text-[#a3a3a3]">
                <p>
                  Every time your application calls an AI model, you pay for tokens in and tokens out.
                  Different models charge different rates, and those rates have been falling &mdash; sometimes
                  dramatically &mdash; as providers compete and hardware improves.
                </p>
                <p>
                  Exostream treats AI pricing the way financial markets treat commodities. Instead of
                  manually checking provider pricing pages, you get a single, structured feed of current
                  prices (<span className="text-[#e5e5e5]">spot</span>), the rate at which prices are
                  declining (<span className="text-[#e5e5e5]">theta</span>), and projections of where
                  prices are headed (<span className="text-[#e5e5e5]">forward curves</span>).
                </p>
                <p>
                  Think of it like a stock ticker for AI costs. The &quot;ticker price&quot; (&beta;) is what
                  a model charges per million output tokens right now. The &quot;Greeks&quot; tell you how
                  your costs behave &mdash; how sensitive they are to context length, caching, and time.
                  The forward curves tell you what the same workload will likely cost 3 or 6 months from now.
                </p>
                <p>
                  This lets you answer questions that matter: <em>Which model is cheapest for my
                  workload? How much will my inference bill drop over the next quarter? Should I lock
                  in a commitment now or wait for prices to fall?</em>
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Fundamental Equation */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">The Fundamental Equation</h2>
                </div>
                <div className="p-4">
                  <div className="bg-[#0a0a0a] p-4 border border-[#262626] mono text-center text-lg mb-4">
                    C(T, M, t) = S(T, M) * D(M, t)
                  </div>
                  <p className="text-[#737373] text-sm">
                    Total expected cost equals spot cost times the decay factor. At spot (t = 0),
                    D = 1 and you get the exact, observable cost.
                  </p>
                </div>
              </div>

              {/* Ticker Price */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">Ticker Price beta</h2>
                </div>
                <div className="p-4">
                  <p className="text-[#737373] text-sm mb-4">
                    The anchor of the model: beta is the published output token price at the origin provider,
                    in USD per million tokens ($/M).
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <span className="mono text-[#06b6d4]">MODEL</span>
                      <span className="text-[#737373]">Sync output reference price</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="mono text-[#06b6d4]">MODEL.B</span>
                      <span className="text-[#737373]">Batch output price</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Structural Greeks */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">Structural Greeks</h2>
                </div>
                <div className="p-4">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>Greek</th>
                        <th>Definition</th>
                        <th>Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="mono text-[#06b6d4]">r_in</td>
                        <td>Input/output price ratio</td>
                        <td>0.20 - 0.50</td>
                      </tr>
                      <tr>
                        <td className="mono text-[#06b6d4]">r_cache</td>
                        <td>Cache price as fraction of output</td>
                        <td>0.01 - 0.10</td>
                      </tr>
                      <tr>
                        <td className="mono text-[#06b6d4]">r_think</td>
                        <td>Thinking token price ratio</td>
                        <td>0.50 - 1.00+</td>
                      </tr>
                      <tr>
                        <td className="mono text-[#06b6d4]">r_batch</td>
                        <td>Batch discount ratio</td>
                        <td>0.40 - 0.60</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Effective Input Rate */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">Effective Input Rate</h2>
                </div>
                <div className="p-4">
                  <div className="bg-[#0a0a0a] p-4 border border-[#262626] mono text-center mb-4">
                    r_in_eff = r_in_depth * (1 - eta) + r_cache * eta
                  </div>
                  <p className="text-[#737373] text-sm">
                    Combines context-depth pricing (for tiered pricing models) with cache discounts.
                    eta is your cache hit ratio (0 to 1).
                  </p>
                </div>
              </div>

              {/* Kappa */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">kappa - The Task&apos;s Delta</h2>
                </div>
                <div className="p-4">
                  <div className="bg-[#0a0a0a] p-4 border border-[#262626] mono text-center mb-4">
                    kappa = 1 + (n_in / n_out) * r_in_eff
                  </div>
                  <p className="text-[#737373] text-sm">
                    kappa is both the context cost multiplier and your delta to beta movements.
                    If beta moves by $1/M, your task cost moves by kappa * n_out * 10^-6.
                  </p>
                </div>
              </div>

              {/* Spot Cost */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">Spot Cost</h2>
                </div>
                <div className="p-4">
                  <div className="bg-[#0a0a0a] p-4 border border-[#262626] mono text-center mb-4">
                    S = beta * [n_out + n_in * r_in_eff + n_think * r_think] * 10^-6
                  </div>
                </div>
              </div>

              {/* Decay Rate */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">Decay Rate theta</h2>
                </div>
                <div className="p-4">
                  <p className="text-[#737373] text-sm mb-4">
                    theta is the continuous monthly decay rate, estimated from historical price data.
                    It absorbs all sources of price decline into a single continuous rate.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-4">
                      <span className="mono text-[#22c55e]">theta {'>'} 0</span>
                      <span className="text-[#737373]">Price declining (typical)</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="mono text-[#737373]">theta = 0</span>
                      <span className="text-[#737373]">Stable pricing</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="mono text-[#ef4444]">theta {'<'} 0</span>
                      <span className="text-[#737373]">Price increasing (rare)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Forward Price */}
              <div className="terminal-box">
                <div className="p-4 border-b border-[#262626]">
                  <h2 className="mono text-sm">Forward Price</h2>
                </div>
                <div className="p-4">
                  <div className="bg-[#0a0a0a] p-4 border border-[#262626] mono text-center mb-4">
                    beta_fwd(M, t) = beta(M) * e^(-theta(M) * t)
                  </div>
                  <p className="text-[#737373] text-sm">
                    Published at standard tenors: 1M, 3M, 6M.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════
              CALCULATOR GUIDE
              ═══════════════════════════════════════════════════ */}
          <section id="calculator-guide">
            <h1 className="mono text-2xl text-[#e5e5e5] mb-2">Calculator Guide</h1>
            <p className="text-[#737373] mb-8">
              How to use the Exostream calculators to understand and forecast your inference costs.
            </p>

            {/* Cost Calculator Guide */}
            <div className="terminal-box mb-8">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-sm text-[#06b6d4]">Cost Calculator</h2>
              </div>
              <div className="p-4 space-y-4 text-sm text-[#a3a3a3]">
                <p>
                  The Cost Calculator prices a <span className="text-[#e5e5e5]">single API call</span>.
                  Open it from the <a href="/calculators#cost-calculator" className="text-[#06b6d4] hover:underline">Calculators</a> page.
                </p>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Step 1: Choose a model</h3>
                  <p>Select the model from the dropdown. The ticker (e.g. OPUS-4.5, GPT-4.1) matches the ticker board on the home page.</p>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Step 2: Set your token counts</h3>
                  <p>
                    <span className="mono text-[#e5e5e5]">n_in</span> &mdash; How many tokens you send to the model (your prompt, context, documents).
                    A typical page of text is ~500 tokens. A long document might be 30K-100K tokens.
                  </p>
                  <p className="mt-2">
                    <span className="mono text-[#e5e5e5]">n_out</span> &mdash; How many tokens the model generates in response.
                    A short answer is ~200 tokens. A detailed code generation might be 2K-4K tokens.
                  </p>
                  <p className="mt-2">
                    <span className="mono text-[#e5e5e5]">n_think</span> &mdash; Only shown for reasoning models (o3, o4-mini, etc.).
                    These models &quot;think&quot; before responding, consuming extra tokens internally.
                  </p>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Step 3: Set cache hit rate</h3>
                  <p>
                    <span className="mono text-[#e5e5e5]">eta</span> &mdash; What percentage of your input tokens are cached from previous calls (0-100%).
                    If you&apos;re sending the same system prompt repeatedly, your cache rate might be 50-80%.
                    For unique prompts each time, set this to 0%.
                  </p>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Step 4: Set forward horizon</h3>
                  <p>
                    <span className="mono text-[#e5e5e5]">horizon</span> &mdash; How far into the future to project the cost.
                    &quot;Spot&quot; gives today&apos;s price. &quot;3M&quot; projects what this call will cost in 3 months,
                    based on the model&apos;s historical price decay rate (theta).
                  </p>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Presets</h3>
                  <p>
                    Use the preset buttons to quickly load common workload profiles:
                  </p>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li><span className="mono text-[#e5e5e5]">RAG</span> &mdash; Retrieval-augmented generation: large context (30K in), short answer (800 out), high cache (60%)</li>
                    <li><span className="mono text-[#e5e5e5]">Code Gen</span> &mdash; Code generation: moderate context (5K in), longer output (2K out), some cache (20%)</li>
                    <li><span className="mono text-[#e5e5e5]">Summarize</span> &mdash; Document summarization: very large input (50K in), short summary (500 out), no cache</li>
                  </ul>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Reading the results</h3>
                  <p>
                    <span className="mono text-[#06b6d4]">Spot Cost</span> &mdash; The cost of this single call at current prices.
                  </p>
                  <p className="mt-2">
                    <span className="mono text-[#e5e5e5]">kappa</span> &mdash; Your context cost multiplier. A kappa of 5 means
                    your call costs 5x what it would if you only paid for output tokens. Higher kappa = more
                    sensitive to model price changes.
                  </p>
                  <p className="mt-2">
                    <span className="mono text-[#22c55e]">Cache Savings</span> &mdash; How much caching is saving you compared to zero caching.
                  </p>
                </div>
              </div>
            </div>

            {/* System Canvas Guide */}
            <div className="terminal-box">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-sm text-[#06b6d4]">System Canvas</h2>
              </div>
              <div className="p-4 space-y-4 text-sm text-[#a3a3a3]">
                <p>
                  The System Canvas models your <span className="text-[#e5e5e5]">entire AI system</span> &mdash;
                  multiple models, task types, and volume &mdash; to project monthly costs and unit economics.
                  Open it from the <a href="/calculators#system-canvas" className="text-[#06b6d4] hover:underline">Calculators</a> page.
                </p>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Choose a preset or customize</h3>
                  <p>
                    Start with a preset that matches your use case &mdash; <span className="text-[#e5e5e5]">GSD</span> for
                    agentic coding, <span className="text-[#e5e5e5]">SaaS</span> for product-integrated AI,
                    <span className="text-[#e5e5e5]"> Trading</span> for high-value analytics, etc. Each preset
                    configures volume, task mix, model allocation, and unit economics to match real-world architectures.
                  </p>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Configure your system</h3>
                  <p>
                    <span className="mono text-[#e5e5e5]">Monthly API Calls</span> &mdash; Total inference calls per month across all task types.
                  </p>
                  <p className="mt-2">
                    <span className="mono text-[#e5e5e5]">Task Distribution</span> &mdash; What percentage of calls are Simple (short),
                    Medium, Complex (long context), or Reasoning (chain-of-thought). Must sum to 100%.
                  </p>
                  <p className="mt-2">
                    <span className="mono text-[#e5e5e5]">Model Allocation</span> &mdash; Which models handle what share of traffic.
                    Add up to 6 models. Weights should sum to 100%.
                  </p>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Unit Economics</h3>
                  <p>
                    Set your <span className="mono text-[#e5e5e5]">revenue per task (p)</span>,
                    <span className="mono text-[#e5e5e5]"> overhead per task (t)</span>, and
                    <span className="mono text-[#e5e5e5]"> fixed monthly costs (F)</span> to see profit margins,
                    break-even volume, and how profitability scales with volume.
                  </p>
                </div>

                <div>
                  <h3 className="mono text-[#e5e5e5] text-xs uppercase tracking-wider mb-2">Optimization Levers</h3>
                  <p>
                    The canvas automatically ranks your biggest savings opportunities &mdash; switching to cheaper
                    models, improving caching, waiting for theta decay, or downshifting heavy tasks. Each lever
                    shows estimated monthly savings in dollars and percentage.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════
              API OVERVIEW
              ═══════════════════════════════════════════════════ */}
          <section id="api">
            <h1 className="mono text-2xl text-[#e5e5e5] mb-2">API</h1>
            <p className="text-[#737373] mb-8">
              The Exostream API provides programmatic access to live pricing data, forward curves, and cost calculations.
              Free tier requires no API key (60 requests/hour per IP).
              See the full <a href="/api-docs" className="text-[#06b6d4] hover:underline">API Reference</a> for curl examples, parameters, and response schemas.
            </p>

            <div className="terminal-box">
              <div className="p-4 border-b border-[#262626]">
                <h2 className="mono text-sm text-[#e5e5e5]">Endpoints</h2>
              </div>
              <div className="p-4">
                <table className="data-table text-sm">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Endpoint</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="mono text-xs px-1.5 py-0.5 bg-[#22c55e]/20 text-[#22c55e]">GET</span></td>
                      <td className="mono text-[#06b6d4]">/v1/spots</td>
                      <td>Current spot prices (beta) for all models</td>
                    </tr>
                    <tr>
                      <td><span className="mono text-xs px-1.5 py-0.5 bg-[#22c55e]/20 text-[#22c55e]">GET</span></td>
                      <td className="mono text-[#06b6d4]">/v1/greeks</td>
                      <td>Full Greek sheet &mdash; spot prices plus structural Greeks and extrinsic parameters</td>
                    </tr>
                    <tr>
                      <td><span className="mono text-xs px-1.5 py-0.5 bg-[#22c55e]/20 text-[#22c55e]">GET</span></td>
                      <td className="mono text-[#06b6d4]">/v1/forwards/:ticker</td>
                      <td>Forward curve for a model at 1M, 3M, 6M tenors</td>
                    </tr>
                    <tr>
                      <td><span className="mono text-xs px-1.5 py-0.5 bg-[#06b6d4]/20 text-[#06b6d4]">POST</span></td>
                      <td className="mono text-[#06b6d4]">/v1/price</td>
                      <td>Calculate cost for a task profile (model, tokens, cache, horizon)</td>
                    </tr>
                    <tr>
                      <td><span className="mono text-xs px-1.5 py-0.5 bg-[#06b6d4]/20 text-[#06b6d4]">POST</span></td>
                      <td className="mono text-[#06b6d4]">/v1/compare</td>
                      <td>Compare all models for a task, ranked by cost</td>
                    </tr>
                    <tr>
                      <td><span className="mono text-xs px-1.5 py-0.5 bg-[#22c55e]/20 text-[#22c55e]">GET</span></td>
                      <td className="mono text-[#06b6d4]">/v1/history/:ticker</td>
                      <td>Historical price data with provenance markers</td>
                    </tr>
                    <tr>
                      <td><span className="mono text-xs px-1.5 py-0.5 bg-[#22c55e]/20 text-[#22c55e]">GET</span></td>
                      <td className="mono text-[#06b6d4]">/v1/events</td>
                      <td>Recent price change events across all models</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-4 text-center">
                  <a href="/api-docs" className="text-[#06b6d4] hover:underline mono text-sm">
                    View full API Reference &rarr;
                  </a>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
