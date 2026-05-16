import { describe, expect, it } from 'vitest';
import { CircularExtendsError, UnknownPlanError, resolvePlan } from './resolve.js';

const baseConfig = {
	plans: {
		free: {
			features: ['read'],
			limits: { apiCalls: { quota: 100, period: 'monthly' as const } },
		},
		pro: {
			extends: 'free',
			features: ['write'],
			limits: { apiCalls: { quota: 1000, period: 'monthly' as const } },
		},
		enterprise: {
			extends: 'pro',
			features: ['admin'],
			limits: { apiCalls: { quota: null, period: 'monthly' as const } },
		},
	},
};

describe('resolvePlan — feature accumulation', () => {
	it('depth 0: returns own features only when no extends', () => {
		const result = resolvePlan(baseConfig, 'free');
		expect(result.features).toEqual(expect.arrayContaining(['read']));
		expect(result.features).toHaveLength(1);
	});

	it('depth 1: accumulates parent features', () => {
		const result = resolvePlan(baseConfig, 'pro');
		expect(result.features).toEqual(expect.arrayContaining(['read', 'write']));
		expect(result.features).toHaveLength(2);
	});

	it('depth 2: accumulates grandparent + parent + own features', () => {
		const result = resolvePlan(baseConfig, 'enterprise');
		expect(result.features).toEqual(expect.arrayContaining(['read', 'write', 'admin']));
		expect(result.features).toHaveLength(3);
	});

	it('depth 3: accumulates through three levels', () => {
		const cfg = {
			plans: {
				a: { features: ['a1'] },
				b: { extends: 'a', features: ['b1'] },
				c: { extends: 'b', features: ['c1'] },
				d: { extends: 'c', features: ['d1'] },
			},
		};
		const result = resolvePlan(cfg, 'd');
		expect(result.features).toEqual(expect.arrayContaining(['a1', 'b1', 'c1', 'd1']));
		expect(result.features).toHaveLength(4);
	});

	it('deduplicates features that appear in both ancestor and descendant', () => {
		const cfg = {
			plans: {
				base: { features: ['read', 'write'] },
				child: { extends: 'base', features: ['read', 'admin'] },
			},
		};
		const result = resolvePlan(cfg, 'child');
		expect(result.features).toEqual(expect.arrayContaining(['read', 'write', 'admin']));
		expect(result.features).toHaveLength(3);
	});
});

describe('resolvePlan — limit inheritance', () => {
	it('inherits limits from ancestor when not overridden', () => {
		const cfg = {
			plans: {
				free: { features: [], limits: { seats: { quota: 1, period: 'monthly' as const } } },
				pro: { extends: 'free', features: [] },
			},
		};
		const result = resolvePlan(cfg, 'pro');
		expect(result.limits.seats).toEqual({ quota: 1, period: 'monthly' });
	});

	it('descendant limit overrides ancestor limit on same key', () => {
		const result = resolvePlan(baseConfig, 'pro');
		expect(result.limits.apiCalls?.quota).toBe(1000);
	});

	it('deepest plan limit wins when all three levels define the same key', () => {
		const result = resolvePlan(baseConfig, 'enterprise');
		expect(result.limits.apiCalls?.quota).toBeNull();
	});

	it('preserves ancestor-only limit keys alongside descendant overrides', () => {
		const cfg = {
			plans: {
				free: {
					features: [],
					limits: {
						seats: { quota: 1, period: 'monthly' as const },
						storage: { quota: 500, period: 'monthly' as const },
					},
				},
				pro: {
					extends: 'free',
					features: [],
					limits: { seats: { quota: 10, period: 'monthly' as const } },
				},
			},
		};
		const result = resolvePlan(cfg, 'pro');
		expect(result.limits.seats?.quota).toBe(10);
		expect(result.limits.storage?.quota).toBe(500);
	});

	it('null quota (unlimited) round-trips correctly', () => {
		const result = resolvePlan(baseConfig, 'enterprise');
		expect(result.limits.apiCalls?.quota).toBeNull();
	});
});

describe('resolvePlan — error cases', () => {
	it('throws UnknownPlanError when root plan does not exist', () => {
		expect(() => resolvePlan(baseConfig, 'ghost')).toThrow(UnknownPlanError);
	});

	it('throws UnknownPlanError when extends target does not exist', () => {
		const cfg = {
			plans: {
				broken: { extends: 'nonexistent', features: [] },
			},
		};
		expect(() => resolvePlan(cfg, 'broken')).toThrow(UnknownPlanError);
	});

	it('UnknownPlanError message names the missing plan', () => {
		const cfg = {
			plans: {
				broken: { extends: 'ghost', features: [] },
			},
		};
		expect(() => resolvePlan(cfg, 'broken')).toThrow(/ghost/);
	});

	it('throws CircularExtendsError on a direct self-reference', () => {
		const cfg = {
			plans: {
				loop: { extends: 'loop', features: [] },
			},
		};
		expect(() => resolvePlan(cfg, 'loop')).toThrow(CircularExtendsError);
	});

	it('throws CircularExtendsError on an indirect cycle (A → B → A)', () => {
		const cfg = {
			plans: {
				a: { extends: 'b', features: [] },
				b: { extends: 'a', features: [] },
			},
		};
		expect(() => resolvePlan(cfg, 'a')).toThrow(CircularExtendsError);
	});

	it('CircularExtendsError message includes the cycle chain', () => {
		const cfg = {
			plans: {
				a: { extends: 'b', features: [] },
				b: { extends: 'a', features: [] },
			},
		};
		expect(() => resolvePlan(cfg, 'a')).toThrow(/a/);
	});

	it('resolves a plan that has no features or limits', () => {
		const cfg = { plans: { empty: { features: [] } } };
		const result = resolvePlan(cfg, 'empty');
		expect(result.features).toEqual([]);
		expect(result.limits).toEqual({});
	});
});
