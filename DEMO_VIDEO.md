# FairX demo recording gate

Record at desktop and verify once at 390×844. Use `/` → `/walkthrough` → archived market → `/proof`.

The video may call the v3 lifecycle verified only when all of these are true:

- `/api/verify/v3-lifecycle` returns `VERIFIED`
- every transaction is finalized and opens on devnet Explorer
- A and B accepted collateral; C alone refunded
- A's payout equals total accepted collateral
- all three user Order/Position accounts are closed
- ProgramData hash matches the recorded deployed binary
- evidence is labelled `TxLINE historical`

These conditions currently pass for the canonical v3 record. If RPC availability makes the verifier `UNKNOWN` during recording, pause and retry; do not substitute the archived v2 record, which is economically incomplete.

Before recording: production build, no console errors, no horizontal overflow, disabled controls on the resolved archive, operator endpoints fail closed, and no secrets appear in client assets or responses.
