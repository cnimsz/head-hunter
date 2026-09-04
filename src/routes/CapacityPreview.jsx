import CapacityIndicator from '../components/CapacityIndicator.jsx';

// All five states of the capacity banner, stacked with static props.
// No RPC call, no ledger writes, no App.jsx state override (spec §Preview
// route). Reached only when window.location.pathname === '/capacity-preview'
// AND VITE_ENABLE_PREVIEW_ROUTES === 'true' (gated in main.jsx).
export default function CapacityPreview() {
  const rows = [
    { label: 'green (>21 days)', capacity: { band: 'green', runwayBucket: 'plenty' } },
    { label: 'amber (7–21 days)', capacity: { band: 'amber', runwayBucket: 'a few weeks' } },
    { label: 'red (<7 days)', capacity: { band: 'red', runwayBucket: 'about a week' } },
    { label: 'empty (balance ≤ 0)', capacity: { band: 'empty', runwayBucket: 'out of credit' } },
    { label: 'unknown (RPC failed)', capacity: null }
  ];
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <h1 className="text-lg font-semibold">Capacity Banner — Preview</h1>
        <p className="text-xs text-slate-500 mt-1">
          All five states, static props. Gated on VITE_ENABLE_PREVIEW_ROUTES.
        </p>
      </header>
      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {rows.map((row) => (
          <section key={row.label}>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
              {row.label}
            </p>
            <CapacityIndicator capacity={row.capacity} />
          </section>
        ))}
      </main>
    </div>
  );
}
