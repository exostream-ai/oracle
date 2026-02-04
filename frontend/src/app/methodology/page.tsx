export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Methodology</h1>

      <div className="prose prose-invert prose-lg">
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">The Fundamental Equation</h2>
          <div className="card bg-surface-light p-6 font-mono text-center text-xl mb-4">
            C(T, M, t) = S(T, M) × D(M, t)
          </div>
          <p className="text-text-secondary">
            Total expected cost equals spot cost times the decay factor. At spot (t = 0),
            D = 1 and you get the exact, observable cost.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Ticker Price β</h2>
          <p className="text-text-secondary mb-4">
            The anchor of the model: β is the published output token price at the origin provider,
            in USD per million tokens ($/M).
          </p>
          <ul className="list-disc list-inside text-text-secondary space-y-2">
            <li><strong className="text-text-primary">MODEL</strong> - Sync output reference price</li>
            <li><strong className="text-text-primary">MODEL.B</strong> - Batch output price</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Structural Greeks</h2>
          <div className="overflow-x-auto">
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
                  <td className="font-mono">r_in</td>
                  <td>Input/output price ratio</td>
                  <td>0.20 – 0.50</td>
                </tr>
                <tr>
                  <td className="font-mono">r_cache</td>
                  <td>Cache price as fraction of output</td>
                  <td>0.01 – 0.10</td>
                </tr>
                <tr>
                  <td className="font-mono">r_think</td>
                  <td>Thinking token price ratio</td>
                  <td>0.50 – 1.00+</td>
                </tr>
                <tr>
                  <td className="font-mono">r_batch</td>
                  <td>Batch discount ratio</td>
                  <td>0.40 – 0.60</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Effective Input Rate</h2>
          <div className="card bg-surface-light p-6 font-mono text-center mb-4">
            r̄_in_eff = r_in_depth × (1 - η) + r_cache × η
          </div>
          <p className="text-text-secondary">
            Combines context-depth pricing (for tiered pricing models) with cache discounts.
            η is your cache hit ratio (0 to 1).
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">κ (Kappa) - The Task's Delta</h2>
          <div className="card bg-surface-light p-6 font-mono text-center mb-4">
            κ = 1 + (n_in / n_out) × r̄_in_eff
          </div>
          <p className="text-text-secondary">
            κ is both the context cost multiplier and your delta to β movements.
            If β moves by $1/M, your task cost moves by κ × n_out × 10⁻⁶.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Spot Cost</h2>
          <div className="card bg-surface-light p-6 font-mono text-center mb-4">
            S = β × [n_out + n_in × r̄_in_eff + n_think × r_think] × 10⁻⁶
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Decay Rate θ</h2>
          <p className="text-text-secondary mb-4">
            θ is the continuous monthly decay rate, estimated from historical price data.
            It absorbs all sources of price decline into a single continuous rate.
          </p>
          <ul className="list-disc list-inside text-text-secondary space-y-2">
            <li><strong className="text-text-primary">θ {'>'} 0</strong>: Price declining (typical)</li>
            <li><strong className="text-text-primary">θ ≈ 0</strong>: Stable pricing</li>
            <li><strong className="text-text-primary">θ {'<'} 0</strong>: Price increasing (rare)</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Forward Price</h2>
          <div className="card bg-surface-light p-6 font-mono text-center mb-4">
            β_fwd(M, t) = β(M) × e^(-θ(M) × t)
          </div>
          <p className="text-text-secondary">
            Published at standard tenors: 1M, 3M, 6M.
          </p>
        </section>
      </div>
    </div>
  );
}
