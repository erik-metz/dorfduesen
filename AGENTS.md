<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Git Workflow & Automation
- You are explicitly allowed and expected to run `git commit` and sync/push (`git push origin main`) for completed tasks in this repository.
- Keep commit messages concise, descriptive, and formatted in conventional commits (e.g., `feat: ...`, `fix: ...`).

## Runtime resource discipline
- Treat Vercel Active CPU and function invocations as a constrained budget. Finish and validate a task locally before one final push; do not publish intermediate fixes or trigger deployments just to inspect them.
- Do not use production backfills, bulk imports, repeated live requests or replay jobs as verification. Run them only when they are part of the user's requested task, with bounded work and deduplication.
- Heavy geometry must have a compute budget and public routes must have an explicit execution limit. A failed expensive computation must not be retried automatically on every visitor or poll.
- Prefer loading low-frequency data on demand. Do not add periodic browser polling without a concrete freshness requirement. Respect Retry-After and deduplicate in-flight requests.
- An in-process cache is only an optimization for one warm instance, never a global resource guarantee. Check cold-cache behavior locally as well.
- When investigating usage, distinguish Active CPU, wall-clock duration, builds and background calls, and record the selected metric/time window. Ignore dashboard demo data.
