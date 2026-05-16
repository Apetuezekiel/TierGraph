# Changelog

All notable changes to tiergraph are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
tiergraph adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-05-16

Initial release.

### Added

- **`defineConfig(config)`** — identity function with `const` type parameter for full literal inference of plan names, feature strings, and limit keys from a static config object.
- **`createAccess(config, { plan, overrides? })`** — resolves the named plan (walking `extends` chains), applies overrides, and returns an `AccessChecker`.
- **`AccessChecker`** — stateless object with `can`, `cannot`, `guard`, and `diff` methods.
  - `guard` throws `AccessDeniedError` with `requiredPlans: string[]` enumerating every plan that grants the blocked feature.
  - `diff(targetPlan)` returns `{ gains, limitUpgrades }` relative to the effective (post-override) feature set.
- **`Overrides`** — `grant` and `revoke` string arrays applied at `createAccess()` time. `grant ∩ revoke` conflicts and unknown features are caught eagerly.
- **`AccessDeniedError`** — structured error with `feature`, `plan`, `requiredPlans`, and `toJSON()`. Prototype is set correctly for cross-module `instanceof`.
- **`InvalidOverrideError`** — structured error with `reason: 'unknown_feature' | 'grant_revoke_conflict'` and `feature`.
- **`extends` single-inheritance** — plans inherit feature sets (accumulated) and limits (descendant wins) from parent plans. Circular and unknown `extends` targets throw at resolution time.
- **`quota: number | null`** — `null` represents unlimited quota. `Infinity` is never used (non-JSON-serializable).
- **`period`** — metadata label (`'monthly' | 'yearly' | 'lifetime'`). The library does not enforce reset dates.
- **JSON Schema** — `schema/config.schema.json` (draft-07) generated from the `ConfigInput` TypeScript type; published alongside the package for validation in non-TypeScript runtimes.
- **Dual ESM + CJS publish** via `tsup`. Types included. Zero runtime dependencies.

### Not included (deferred to v1.1+)

- `createUsage`, `usage.check`, `usage.hasCapacity` — usage tracking
- `overrides.limits` — per-call limit overrides
- React, Express, Next.js bindings
- Persistence, remote config, telemetry
