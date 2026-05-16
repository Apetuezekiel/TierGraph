import { assertType, describe, expectTypeOf, it } from 'vitest';
import { defineConfig } from '../src/index.js';

describe('defineConfig type inference', () => {
	it('infers literal plan names from static config', () => {
		const cfg = defineConfig({
			plans: {
				free: { features: ['read'] as const },
				pro: { extends: 'free', features: ['write'] as const },
			},
		});

		// Plan keys are literal types
		expectTypeOf(cfg.plans).toHaveProperty('free');
		expectTypeOf(cfg.plans).toHaveProperty('pro');

		// Features are literal string tuple, not string[]
		expectTypeOf(cfg.plans.free.features).toEqualTypeOf<readonly ['read']>();
		expectTypeOf(cfg.plans.pro.features).toEqualTypeOf<readonly ['write']>();
	});

	it('extends field accepts string (compatible with plan name)', () => {
		const cfg = defineConfig({
			plans: {
				free: { features: [] as const },
				pro: { extends: 'free', features: [] as const },
			},
		});
		assertType<string | undefined>(cfg.plans.pro.extends);
	});

	it('limits quota accepts number or null', () => {
		const cfg = defineConfig({
			plans: {
				pro: {
					features: [] as const,
					limits: {
						seats: { quota: 5, period: 'monthly' as const },
						storage: { quota: null, period: 'yearly' as const },
					},
				},
			},
		});
		// Access via a narrowed reference to avoid non-null assertion
		const limits = cfg.plans.pro.limits;
		if (limits !== undefined) {
			assertType<number | null>(limits.seats.quota);
			assertType<number | null>(limits.storage.quota);
		}
	});
});
