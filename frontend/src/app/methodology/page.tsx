export default function MethodologyPage() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-8">
      <h1 className="text-xl mono mb-8">Methodology</h1>

      <div className="space-y-8">
        {/* Fundamental Equation */}
        <section className="terminal-box">
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
        </section>

        {/* Ticker Price */}
        <section className="terminal-box">
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
        </section>

        {/* Structural Greeks */}
        <section className="terminal-box">
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
        </section>

        {/* Effective Input Rate */}
        <section className="terminal-box">
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
        </section>

        {/* Kappa */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <h2 className="mono text-sm">kappa - The Task's Delta</h2>
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
        </section>

        {/* Spot Cost */}
        <section className="terminal-box">
          <div className="p-4 border-b border-[#262626]">
            <h2 className="mono text-sm">Spot Cost</h2>
          </div>
          <div className="p-4">
            <div className="bg-[#0a0a0a] p-4 border border-[#262626] mono text-center mb-4">
              S = beta * [n_out + n_in * r_in_eff + n_think * r_think] * 10^-6
            </div>
          </div>
        </section>

        {/* Decay Rate */}
        <section className="terminal-box">
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
        </section>

        {/* Forward Price */}
        <section className="terminal-box">
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
        </section>
      </div>
    </div>
  );
}
