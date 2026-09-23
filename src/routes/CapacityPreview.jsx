import CapacityIndicator from '../components/CapacityIndicator.jsx';

// All five capacity states, rendered twice: with the Donate CTA wired to a
// dummy URL, and with it unset (button hidden). Gated on
// VITE_ENABLE_PREVIEW_ROUTES in main.jsx; no RPC, no ledger writes.
//
// Thank-you notice: visit /capacity-preview?donated=1 to see it. The mount
// effect in CapacityIndicator consumes the param, shows the notice, marks
// the shared cooldown key, and strips the param — so the first row that
// mounts wins and the rest render normally. Reload without the param to
// reset (also clear cv-toolkit:capacity-dismissed-at to un-suppress the
// CTA after the first pass).
const DUMMY_DONATE_URL = 'https://buy.stripe.com/test_preview_only';

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
          All five states × Donate URL set / unset. Gated on VITE_ENABLE_PREVIEW_ROUTES.
          Append <code>?donated=1</code> to this URL to preview the thank-you notice.
        </p>
      </header>
      <main className="max-w-7xl mx-auto p-4 space-y-8">
        {rows.map((row) => (
          <section key={row.label}>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
              {row.label}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                  VITE_DONATE_URL set
                </p>
                <CapacityIndicator capacity={row.capacity} donateUrl={DUMMY_DONATE_URL} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">
                  VITE_DONATE_URL unset
                </p>
                <CapacityIndicator capacity={row.capacity} donateUrl="" />
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
