# Claude Handoff — ANFA Commerce Backend
Updated: 2026-11-06

Canonical cross-project notes: https://github.com/KAMIL-HAITAM/anfa-athletics-website/blob/master/CLAUDE_HANDOFF.md

## Repository
- Repo: https://github.com/KAMIL-HAITAM/anfa-commerce-backend
- Default branch seen during handoff: main.
- Medusa 2.22.1 Turbo monorepo, Node engine >=22.23.4.
- Confirm actual current files, git history, and tests before changes; the README remains substantially the Medusa starter template.
- Creator-program modules/routes/workflows exist in the checked-in repository. A checked source route is apps/backend/src/api/admin/creators/route.ts.

## Intended brand and user preferences
ANFA ATHLETICS is a premium athleticwear brand in Casablanca, Morocco. Collection FORGED 01; aesthetic is raw luxury, minimal industrial, technical. User prefers targeted changes, explicit backups, clear PowerShell commands, and honest statements about what was tested. Never commit credentials or .env files.

## Commerce state: do not treat as production-ready
- In earlier local work, the Morocco/MAD region was configured; a previously recorded ID was reg_01M5ZS40Q027QDGECE9TRSJBBH. Verify it from current state rather than assuming it has not changed.
- Checkout is intentionally not live: Medusa cart sync in the frontend was disabled during pre-launch work; payment provider remains placeholder (System/DEFAULT); shipping quotes, real payment, inventory and end-to-end checkout remain unfinished.
- Do not turn on production checkout or create live orders until payment/shipping/inventory and failure paths are tested.

## Creator program and commissions
- Creator activate/deactivate toggle and promotion status were previously tested successfully.
- Required commission rules from the product owner:
  1. commissionable base = eligible merchandise subtotal after discounts, excluding shipping;
  2. commission starts pending on order placement;
  3. approve only once the order is delivered AND paid;
  4. void on cancellation;
  5. partial refunds proportionally reduce commission;
  6. payouts are manual.
- These are requirements, not proof that every code path is correct. Inspect and test normal order, delayed payment, delivery, cancellation, partial refund, full refund, duplicate webhook/retry, and missing/invalid creator-code scenarios.
- A historical test commission was 34.06 MAD for 227.05 MAD eligible subtotal at 15%, but its test order was later cancelled. Do not treat it as a real payout.

## Glovo
- Foundational tracking/manual delivery confirmation was added in earlier local work.
- Live dispatch, production credentials, webhooks and true end-to-end tests remain unfinished. Do not claim Glovo is production-ready.

## Safety and engineering rules
- Inspect current code before editing and run repository-supported build/lint/tests.
- Never commit secrets; search git history for accidental .env/credential exposure and advise rotating any real keys that were exposed.
- Keep scope targeted; use tests for business-critical lifecycle logic.
- Distinguish verified tests from assumptions or earlier chat history.
- Website repo: https://github.com/KAMIL-HAITAM/anfa-athletics-website
- Separate local 3D project is at C:\Users\Asus ExpertBook 15\Documents\anfa-charactercreator and was not present in the user's GitHub repository list at handoff time. It needs to be made available privately before Claude can inspect its current Blender scripts and generated prototypes.
