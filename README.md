# tiergraph

Zero-runtime-dependency TypeScript library for SaaS tier-based feature gating.

Define your pricing plans once, enforce feature access everywhere — with full literal-type inference, structured errors, and a small audit surface.

---

## Installation

```bash
npm install tiergraph
```

Node 18+. Zero runtime dependencies.

---

## 60-second quick start

```ts
import { defineConfig, createAccess } from 'tiergraph';

const config = defineConfig({
  plans: {
    free: {
      features: ['read', 'export_csv'],
      limits: { apiCalls: { quota: 100, period: 'monthly' } },
    },
    pro: {
      extends: 'free',
      features: ['write', 'webhooks'],
      limits: { apiCalls: { quota: 5000, period: 'monthly' } },
    },
    enterprise: {
      extends: 'pro',
      features: ['sso', 'audit_log'],
      limits: { apiCalls: { quota: null, period: 'monthly' } }, // null = unlimited
    },
  },
});

const access = createAccess(config, { plan: 'pro' });

access.can('write');        // true  — pro has write
access.can('sso');          // false — sso is enterprise-only
access.cannot('sso');       // true

access.guard('write');      // no-op
access.guard('sso');        // throws AccessDeniedError

const upgrade = access.diff('enterprise');
// { gains: ['sso', 'audit_log'], limitUpgrades: { apiCalls: { from: 5000, to: null } } }
```

---

## API reference

### `defineConfig(config)`

Identity function that preserves literal types from an inline or `const`-asserted object. Pass it once at module load; share the result across your app.

```ts
const config = defineConfig({ plans: { ... } });
```

Returns the same object unchanged. Its only job is to let TypeScript infer literal plan names, feature strings, and limit keys so that downstream calls are fully typed.

---

### `createAccess(config, options)`

```ts
createAccess(config, { plan: string, overrides?: Overrides }): AccessChecker
```

Resolves the named plan (walking the `extends` chain), applies overrides, and returns a stateless checker object. Throws `InvalidOverrideError` at call time if overrides are invalid.

**Options:**

| Field | Type | Description |
|---|---|---|
| `plan` | `string` | Name of the plan to check against |
| `overrides` | `Overrides` (optional) | Per-call `grant` / `revoke` feature list |

---

### `AccessChecker`

#### `.can(feature: string): boolean`

Returns `true` if the feature is in the effective set (plan + overrides).

#### `.cannot(feature: string): boolean`

Negation of `can`. Equivalent to `!access.can(feature)`.

#### `.guard(feature: string): void`

Throws `AccessDeniedError` if the feature is not in the effective set. Use this at the boundary of a protected operation.

```ts
// Express example (documentation only — not a published binding)
app.post('/webhooks', (req, res) => {
  access.guard('webhooks');  // throws if not allowed
  // ... handler
});
```

#### `.diff(targetPlan: string): DiffResult`

Returns what the current context would gain by switching to `targetPlan`.

```ts
interface DiffResult {
  gains: string[];                                                   // features in target not in effective set
  limitUpgrades: Record<string, { from: number | null; to: number | null }>;
}
```

`gains` excludes features already granted via override. Use `diff` to build upgrade prompts:

```ts
const { gains, limitUpgrades } = access.diff('enterprise');
// gains: ['sso', 'audit_log']
// limitUpgrades: { apiCalls: { from: 5000, to: null } }
```

---

### `Overrides`

```ts
interface Overrides {
  grant?: string[];   // add features not in the plan (e.g., grandfathering)
  revoke?: string[];  // remove features the plan would otherwise include (e.g., compliance)
}
```

**Override semantics:**
- `grant` adds features; they count as part of the effective set
- `revoke` removes features, including inherited ones — revoke beats inheritance
- A feature in both `grant` and `revoke` throws `InvalidOverrideError` at `createAccess()` time — conflicts must be resolved explicitly
- Any feature string not declared in the config throws `InvalidOverrideError` — typos are caught at call time

---

### `AccessDeniedError`

Thrown by `guard` when access is denied.

```ts
class AccessDeniedError extends Error {
  readonly name: 'AccessDeniedError';
  readonly feature: string;
  readonly plan: string;
  readonly requiredPlans: string[];  // all plans whose resolved set includes the feature
  toJSON(): Record<string, unknown>; // JSON-serializable shape
}
```

`requiredPlans` is the set of plan names (across the whole config) that grant the feature. Use it to build "upgrade to one of these plans" messaging.

---

### `InvalidOverrideError`

Thrown by `createAccess` when overrides are invalid.

```ts
class InvalidOverrideError extends Error {
  readonly name: 'InvalidOverrideError';
  readonly reason: 'unknown_feature' | 'grant_revoke_conflict';
  readonly feature: string;
  toJSON(): Record<string, unknown>;
}
```

---

### `Limit`

```ts
interface Limit {
  quota: number | null;  // null means unlimited; never use Infinity
  period: 'monthly' | 'yearly' | 'lifetime';  // metadata label only — see note below
}
```

---

### `defineConfig` schema

```ts
interface ConfigInput {
  plans: Record<string, PlanInput>;
}

interface PlanInput {
  extends?: string;               // single-inheritance: name of a parent plan
  features: string[];
  limits?: Record<string, Limit>;
}
```

`extends` resolves recursively (depth is unbounded). Circular references throw at `createAccess()` time.

---

## Override examples

### Grandfathering a legacy customer

A customer signed up when the `export_csv` feature was on the free plan. You moved it to pro, but you want to honour their existing access.

```ts
const access = createAccess(config, {
  plan: 'free',
  overrides: { grant: ['export_csv'] },
});

access.can('export_csv'); // true — grandfathered
```

### Compliance removal

A regulated customer must not have access to `webhooks` even though they're on the pro plan.

```ts
const access = createAccess(config, {
  plan: 'pro',
  overrides: { revoke: ['webhooks'] },
});

access.can('webhooks'); // false — revoked for compliance
```

---

## Diff example — upgrade prompt

```ts
const freeToPro = createAccess(config, { plan: 'free' }).diff('pro');
// freeToPro.gains: ['write', 'webhooks']
// freeToPro.limitUpgrades: { apiCalls: { from: 100, to: 5000 } }

// Render in UI:
// "Upgrade to Pro to unlock: write, webhooks"
// "Your API call limit goes from 100 to 5,000/month"
```

---

## Dynamic config (runtime JSON)

When you load a config from a file or remote source, TypeScript cannot infer literal types from a `string` value — the config collapses to `Config<string, string, string>`. This is expected.

```ts
import { createAccess } from 'tiergraph';
import type { ConfigInput } from 'tiergraph';
import rawConfig from './tiergraph.config.json' assert { type: 'json' };

// Type is ConfigInput, not the narrowed literal form
const config = rawConfig as ConfigInput;

const access = createAccess(config, { plan: 'pro' });

// can/cannot/guard still work correctly at runtime —
// you just lose compile-time exhaustiveness of plan/feature names
access.can('write'); // true at runtime; no autocomplete on 'write'
```

**Validation:** use the published JSON Schema to validate the config before passing it to `createAccess`:

```ts
import Ajv from 'ajv';
import schema from 'tiergraph/schema/config.schema.json' assert { type: 'json' };

const ajv = new Ajv();
const validate = ajv.compile(schema);

if (!validate(rawConfig)) {
  throw new Error(`Invalid tiergraph config: ${ajv.errorsText(validate.errors)}`);
}
```

---

## What the library does not do

These are intentional non-features in v1:

- **No usage tracking.** `createAccess` does not count calls, record events, or enforce quotas against a running total. The `limits` field in the schema is metadata for your own tooling.
- **No period reset enforcement.** `period: 'monthly'` is a label. tiergraph does not own a clock, does not compute reset dates, and does not accept a `periodStart` parameter.
- **No persistence.** There is no built-in store, cache, or session layer.
- **No remote config fetching.** Config is a plain JS object; fetching it from a URL or database is your responsibility.
- **No authentication or authorization beyond feature gating.** tiergraph does not know who the caller is — you pass the plan name in.
- **No billing integration.** No Stripe, no Paddle, no subscription lifecycle management.
- **No framework bindings.** See the framework glue section below for the 5-line pattern.

---

## Framework glue (documentation only)

These are illustrative patterns — not published packages.

### React

```tsx
// hooks/useAccess.ts
import { createAccess } from 'tiergraph';
import { config } from '../tiergraph.config';

export function useAccess(plan: string) {
  return createAccess(config, { plan });
}

// In a component:
const access = useAccess(user.plan);
{access.can('webhooks') && <WebhooksTab />}
```

### Express

```ts
// middleware/gate.ts
import { createAccess, AccessDeniedError } from 'tiergraph';
import { config } from '../tiergraph.config';

export function gate(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      createAccess(config, { plan: req.user.plan }).guard(feature);
      next();
    } catch (err) {
      if (err instanceof AccessDeniedError) res.status(403).json(err.toJSON());
      else next(err);
    }
  };
}
```

---

## Comparison

### vs. LaunchDarkly / feature flag services

LaunchDarkly and similar tools are optimized for gradual rollouts, A/B testing, and remote toggling with sub-second propagation. tiergraph is optimized for **plan-scoped entitlements** that are defined once and enforced everywhere — no SDK, no network call, no remote dependency. If you need per-user targeting or real-time flag updates, use a feature flag service. If you need "does this customer's plan include feature X?", use tiergraph.

### vs. Stripe Entitlements

Stripe Entitlements ties feature access to Stripe subscription state. That's correct if your source of truth is Stripe. tiergraph is source-of-truth-agnostic — you own the plan assignment, fetching it from your own database, JWT, or session. You can combine both: resolve the plan from Stripe, then pass it to `createAccess`.

---

## Versioning and stability

tiergraph follows [Semantic Versioning](https://semver.org/). The current version is `0.x`, which means:

- Breaking changes may happen between minor versions while the API stabilises
- All breaking changes are documented in [CHANGELOG.md](./CHANGELOG.md)
- Once `1.0.0` is released, the public API surface (everything exported from the package root) is stable

Pin to a minor version range (`^0.1.0`) until `1.0.0`.

---

## License

MIT — see [LICENSE](./LICENSE).
