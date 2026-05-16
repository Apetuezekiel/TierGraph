import { describe, expect, it } from 'vitest';
import { createAccess } from './access.js';
import { AccessDeniedError, InvalidOverrideError } from './errors.js';

const config = {
	plans: {
		free: {
			features: ['read'],
			limits: { apiCalls: { quota: 100, period: 'monthly' as const } },
		},
		pro: {
			extends: 'free',
			features: ['write', 'export'],
			limits: { apiCalls: { quota: 1000, period: 'monthly' as const } },
		},
		enterprise: {
			extends: 'pro',
			features: ['admin'],
			limits: { apiCalls: { quota: null, period: 'monthly' as const } },
		},
	},
};

describe('createAccess — can / cannot', () => {
	it('can returns true for a feature on the plan', () => {
		const access = createAccess(config, { plan: 'free' });
		expect(access.can('read')).toBe(true);
	});

	it('can returns false for a feature not on the plan', () => {
		const access = createAccess(config, { plan: 'free' });
		expect(access.can('write')).toBe(false);
	});

	it('cannot is the negation of can', () => {
		const access = createAccess(config, { plan: 'pro' });
		expect(access.cannot('write')).toBe(false);
		expect(access.cannot('admin')).toBe(true);
	});

	it('can returns true for inherited features', () => {
		const access = createAccess(config, { plan: 'pro' });
		expect(access.can('read')).toBe(true);
	});
});

describe('createAccess — guard', () => {
	it('guard does not throw when feature is accessible', () => {
		const access = createAccess(config, { plan: 'pro' });
		expect(() => access.guard('write')).not.toThrow();
	});

	it('guard throws AccessDeniedError when feature is inaccessible', () => {
		const access = createAccess(config, { plan: 'free' });
		expect(() => access.guard('write')).toThrow(AccessDeniedError);
	});

	it('AccessDeniedError carries correct feature and plan', () => {
		const access = createAccess(config, { plan: 'free' });
		try {
			access.guard('admin');
			expect.fail('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(AccessDeniedError);
			if (err instanceof AccessDeniedError) {
				expect(err.feature).toBe('admin');
				expect(err.plan).toBe('free');
			}
		}
	});

	it('requiredPlans lists all plans granting the feature', () => {
		const access = createAccess(config, { plan: 'free' });
		try {
			access.guard('admin');
			expect.fail('should have thrown');
		} catch (err) {
			if (err instanceof AccessDeniedError) {
				// 'admin' is only in enterprise (pro and enterprise both resolve it through enterprise)
				expect(err.requiredPlans).toContain('enterprise');
			}
		}
	});

	it('requiredPlans enumerates multiple plans when feature exists in several', () => {
		const access = createAccess(config, { plan: 'free' });
		try {
			access.guard('write');
			expect.fail('should have thrown');
		} catch (err) {
			if (err instanceof AccessDeniedError) {
				// 'write' is in pro and enterprise (enterprise extends pro)
				expect(err.requiredPlans).toContain('pro');
				expect(err.requiredPlans).toContain('enterprise');
				expect(err.requiredPlans).not.toContain('free');
			}
		}
	});

	it('AccessDeniedError is JSON-serializable', () => {
		const access = createAccess(config, { plan: 'free' });
		try {
			access.guard('write');
		} catch (err) {
			if (err instanceof AccessDeniedError) {
				const json = JSON.parse(JSON.stringify(err.toJSON()));
				expect(json.name).toBe('AccessDeniedError');
				expect(json.feature).toBe('write');
			}
		}
	});
});

describe('createAccess — overrides: grant', () => {
	it('grant adds a feature not on the plan', () => {
		const access = createAccess(config, { plan: 'free', overrides: { grant: ['write'] } });
		expect(access.can('write')).toBe(true);
	});

	it('granted feature does not trigger guard', () => {
		const access = createAccess(config, { plan: 'free', overrides: { grant: ['write'] } });
		expect(() => access.guard('write')).not.toThrow();
	});

	it('throws InvalidOverrideError for unknown feature in grant', () => {
		expect(() =>
			createAccess(config, { plan: 'free', overrides: { grant: ['nonexistent'] } }),
		).toThrow(InvalidOverrideError);
	});
});

describe('createAccess — overrides: revoke', () => {
	it('revoke removes a feature from the plan', () => {
		const access = createAccess(config, { plan: 'pro', overrides: { revoke: ['export'] } });
		expect(access.can('export')).toBe(false);
	});

	it('revoke beats inheritance — removes an inherited feature', () => {
		const access = createAccess(config, { plan: 'pro', overrides: { revoke: ['read'] } });
		expect(access.can('read')).toBe(false);
	});

	it('throws InvalidOverrideError for unknown feature in revoke', () => {
		expect(() => createAccess(config, { plan: 'free', overrides: { revoke: ['ghost'] } })).toThrow(
			InvalidOverrideError,
		);
	});
});

describe('createAccess — overrides: grant∩revoke conflict', () => {
	it('throws InvalidOverrideError when same feature in grant and revoke', () => {
		expect(() =>
			createAccess(config, { plan: 'free', overrides: { grant: ['write'], revoke: ['write'] } }),
		).toThrow(InvalidOverrideError);
	});
});

describe('createAccess — diff', () => {
	it('gains lists features in target not in current effective set', () => {
		const access = createAccess(config, { plan: 'free' });
		const result = access.diff('pro');
		expect(result.gains).toContain('write');
		expect(result.gains).toContain('export');
		expect(result.gains).not.toContain('read');
	});

	it('gains excludes features already granted via override', () => {
		// free + grant(write) → effective has write; diff to pro should not list write as a gain
		const access = createAccess(config, { plan: 'free', overrides: { grant: ['write'] } });
		const result = access.diff('pro');
		expect(result.gains).not.toContain('write');
		expect(result.gains).toContain('export');
	});

	it('limitUpgrades shows quota diff when upgrading', () => {
		const access = createAccess(config, { plan: 'free' });
		const result = access.diff('pro');
		expect(result.limitUpgrades.apiCalls).toEqual({ from: 100, to: 1000 });
	});

	it('limitUpgrades handles null (unlimited) in target', () => {
		const access = createAccess(config, { plan: 'pro' });
		const result = access.diff('enterprise');
		expect(result.limitUpgrades.apiCalls).toEqual({ from: 1000, to: null });
	});

	it('limitUpgrades is empty when limits are identical', () => {
		const access = createAccess(config, { plan: 'free' });
		const result = access.diff('free');
		expect(result.limitUpgrades).toEqual({});
	});

	it('gains is empty when diffing against same plan', () => {
		const access = createAccess(config, { plan: 'pro' });
		const result = access.diff('pro');
		expect(result.gains).toEqual([]);
	});

	it('diff works when target plan has null quota (unlimited)', () => {
		const access = createAccess(config, { plan: 'free' });
		const result = access.diff('enterprise');
		expect(result.limitUpgrades.apiCalls).toEqual({ from: 100, to: null });
	});

	it('limitUpgrades includes keys present only in target plan', () => {
		const asymConfig = {
			plans: {
				basic: { features: ['read'], limits: {} },
				plus: {
					features: ['read', 'write'],
					limits: { storage: { quota: 50, period: 'monthly' as const } },
				},
			},
		};
		const access = createAccess(asymConfig, { plan: 'basic' });
		const result = access.diff('plus');
		// 'storage' only exists in plus — from should be null (no entry in basic)
		expect(result.limitUpgrades.storage).toEqual({ from: null, to: 50 });
	});

	it('limitUpgrades includes keys present only in current plan', () => {
		const asymConfig = {
			plans: {
				plus: {
					features: ['read', 'write'],
					limits: { storage: { quota: 50, period: 'monthly' as const } },
				},
				basic: { features: ['read'], limits: {} },
			},
		};
		const access = createAccess(asymConfig, { plan: 'plus' });
		const result = access.diff('basic');
		// 'storage' only exists in plus — to should be null (no entry in basic)
		expect(result.limitUpgrades.storage).toEqual({ from: 50, to: null });
	});
});

describe('createAccess — guard with broken config plans', () => {
	it('guard still throws AccessDeniedError when some plans in config cannot be resolved', () => {
		// 'broken' extends a nonexistent plan; computeRequiredPlans should skip it gracefully
		const brokenConfig = {
			plans: {
				valid: { features: ['read'] },
				broken: { extends: 'nonexistent', features: ['write'] },
			},
		};
		const access = createAccess(brokenConfig, { plan: 'valid' });
		expect(() => access.guard('write')).toThrow(AccessDeniedError);
	});

	it('requiredPlans excludes unresolvable plans', () => {
		const brokenConfig = {
			plans: {
				valid: { features: ['read'] },
				broken: { extends: 'nonexistent', features: ['write'] },
			},
		};
		const access = createAccess(brokenConfig, { plan: 'valid' });
		try {
			access.guard('write');
			expect.fail('should have thrown');
		} catch (err) {
			if (err instanceof AccessDeniedError) {
				expect(err.requiredPlans).not.toContain('broken');
			}
		}
	});
});
