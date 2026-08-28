# Spec — Capacity Indicator, Donation Prompt, Waitlist

**Target:** `/specs/capacity-indicator.md`
**Depends on:** `phase-0-2-guardrails.md` (§3 schema, §5a `get_balance_usd()`) and a live Stripe Payment Link.

**Note:** §3 below references `credit_state`. Under §5a that table does not exist — read the balance from `get_balance_usd()` instead.

---

## 1. Purpose

Surface remaining compute as a traffic light, ask for support at the moment the tool has just delivered value, and capture the lead instead of losing it when credits run out.

---

## 2. Hard constraints

**The band must be computed from the real derived balance.** Never hardcode, never leave it permanently amber. A fabricated scarcity signal on a site soliciting money is a misleading commercial practice under §5 UWG and is precisely the kind of thing that draws an Abmahnung in Germany. If §5 polling fails, fall back to the last known band and log it — do not invent one.

**Never expose the balance figure.** Band only. The dollar number tells anyone hostile exactly how cheap it is to drain the account.

**Nothing is gated.** No donation unlocks any feature. This keeps donations outside VAT scope — no supply, no consideration, no direct link. Any perk changes the tax position.

---

## 3. Bands

Derived as **days of runway**, not absolute dollars — €20 means different things at different traffic levels.

```
daily_burn  = max(trailing_24h_spend, trailing_7day_avg_daily_spend, floor)
runway_days = balance_usd / daily_burn
```

Two reasons for the `max()`. The floor stops a quiet week reporting infinite runway. Taking the higher of the 24-hour and 7-day figures makes the indicator react to a spike within hours rather than days — at a $50 balance, a traffic spike can drain the account faster than a 7-day average can register it, which would jump the band straight from green to empty and skip the only state that asks for money.

| Band | Runway | Behaviour |
|---|---|---|
| `green` | > 21 days | Indicator hidden entirely |
| `amber` | 7–21 days | Indicator shown, donation prompt eligible |
| `red` | < 7 days | Indicator shown, stronger copy |
| `empty` | balance ≤ 0 | Service suspended, waitlist state (§6) |

Three visible bands, not five. Dark-green vs light-green does not change behaviour and costs legibility. Add a fourth only if a state earns different behaviour.

**Exposure:** a `security definer` RPC — `get_capacity_band()` — returning `{ band, runway_bucket }` where the bucket is coarse text (`"about a week"`, `"a few weeks"`). Never the number. Grant execute to `anon` and `authenticated`. No direct table access.

---

## 4. Placement

**Post-tailoring success screen only.** Not the landing page, not global chrome.

Scarcity messaging before value suppresses signup — job seekers are risk-averse about tools holding career materials, and "nearly out of money" reads as "this disappears mid-search." After a successful tailoring, the same message reads as a fair cost disclosure.

Slim bar, dismissible, below the result — never a modal over it.

---

## 5. Donation prompt

**Cooldown: 3 days per user.** Store `last_capacity_prompt_at` on the user's profile row.

**Copy — progress framing, not deficit:**

> This month's compute is about 60% covered. €4 keeps it running for a day.

Never "donate so I can build your feature." Payment tied to a named deliverable for a named person reintroduces the direct link that ungated donations avoid, and creates a *Zweckverfehlung* restitution exposure under §812 BGB if the thing never ships.

**Button:** Stripe Payment Link, one-time, pay-what-you-want, new tab. No Checkout Session, no webhook, no schema.

**Instrumentation — required, not optional:**

```sql
create table if not exists public.prompt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('capacity_impression','capacity_click','capacity_dismiss','waitlist_signup')),
  band text,
  created_at timestamptz not null default now()
);
alter table public.prompt_events enable row level security;
create policy "insert own events" on public.prompt_events
  for insert to authenticated with check (user_id = auth.uid());
```

The 3-day cooldown is a guess. Impressions and clicks are what let it be tuned. If click-through collapses by the third showing, lengthen it.

---

## 6. Empty state

When `band = 'empty'`, the proxy returns `503` with `{ error: "NO_CAPACITY" }` and the UI renders a waitlist panel instead of the tool.

**Copy (Colin's wording, verbatim):**

> Awaiting on more donations to refill credits, will notify when refilled.

Plus an email field and a donate button.

```sql
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email)
);
alter table public.waitlist enable row level security;
create policy "anyone can join" on public.waitlist
  for insert to anon, authenticated with check (true);
-- No select policy. service_role reads for the notify batch.
```

Notification on refill is manual for now — export and send via Resend. Automate only if the empty state actually fires.

**Note for Colin:** if you refill within hours every time, this copy stops matching reality, and a repeat visitor learns the message is decorative. That's the exact frame you're preserving for pay-it-forward. Either let a real gap happen or revise the copy once the refill cadence is known.

---

## 7. Draft persistence

Any form a user types into before an auth wall — suggestions later, waitlist email now — persists to `localStorage` before the magic-link redirect and restores on return. A lost draft after an email round-trip is a user who does not come back.

---

## 8. Acceptance

- [ ] `get_capacity_band()` returns a band; no query path exposes `balance_usd` or `credit_topups`.
- [ ] Green → indicator absent from the DOM entirely.
- [ ] Amber → bar renders on success screen only; absent from landing page.
- [ ] Prompt does not re-render within 3 days of dismissal for the same user.
- [ ] `prompt_events` logs impression, click and dismiss with the band attached.
- [ ] Balance ≤ 0 → proxy returns 503 before any Anthropic call; waitlist renders; email insert succeeds while signed out.
- [ ] Polling failure → last known band retained, never `empty`.
- [ ] Duplicate waitlist email → handled gracefully, no 500.
