// Every <funding-status> state, rendered with the support URL set (whole pill
// is a link + CTA badge) and unset (plain pill). Also shows the module's
// defaults, a custom-description example, and forced light/dark themes.
// Gated on VITE_ENABLE_PREVIEW_ROUTES in main.jsx; the `band` attribute is
// set on every instance, so there is no RPC and no analytics write.
const DUMMY_SUPPORT_URL = 'https://ko-fi.com/cvtool';

const ROWS = [
  { label: 'green (>21 days)', band: 'green' },
  { label: 'amber (7–21 days)', band: 'amber' },
  { label: 'red (<7 days)', band: 'red' },
  { label: 'empty (balance ≤ 0)', band: 'empty' },
  { label: 'unknown (RPC failed)', band: 'unknown' }
];

function Caption({ children }) {
  return <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{children}</p>;
}

export default function CapacityPreview() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <h1 className="text-lg font-semibold">Funding Status — Preview</h1>
        <p className="text-xs text-slate-500 mt-1">
          All states × support URL set / unset. Gated on VITE_ENABLE_PREVIEW_ROUTES.
        </p>
      </header>
      <main className="max-w-7xl mx-auto p-4 space-y-8">
        {ROWS.map((row) => (
          <section key={row.band}>
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">{row.label}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Caption>support-url set</Caption>
                <funding-status
                  band={row.band}
                  support-url={DUMMY_SUPPORT_URL}
                  empty-text="Out — tailoring paused"
                />
              </div>
              <div>
                <Caption>support-url unset</Caption>
                <funding-status band={row.band} empty-text="Out — tailoring paused" />
              </div>
            </div>
          </section>
        ))}

        <section>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
            Other projects — custom descriptions
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Caption>module defaults (no empty-text / tagline)</Caption>
              <funding-status band="empty" support-url={DUMMY_SUPPORT_URL} />
            </div>
            <div>
              <Caption>tagline + cta-text overridden</Caption>
              <funding-status
                band="amber"
                support-url={DUMMY_SUPPORT_URL}
                tagline="Weekly reports — kept free by readers like you"
                cta-text="Chip in"
              />
            </div>
            <div className="rounded-lg bg-white p-3">
              <Caption>theme=&quot;light&quot;</Caption>
              <funding-status band="green" support-url={DUMMY_SUPPORT_URL} theme="light" />
            </div>
            <div className="rounded-lg bg-slate-900 p-3">
              <Caption>theme=&quot;dark&quot;</Caption>
              <funding-status band="red" support-url={DUMMY_SUPPORT_URL} theme="dark" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
