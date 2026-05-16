import { describe, expect, it } from 'vitest';
import { InvalidOverrideError } from './errors.js';
import { applyOverrides } from './overrides.js';

const config = {
	plans: {
		free: { features: ['read'] },
		pro: { extends: 'free', features: ['write', 'export'] },
		enterprise: { extends: 'pro', features: ['admin'] },
	},
};

const resolvedFree = { features: ['read'], limits: {} };
const resolvedPro = { features: ['read', 'write', 'export'], limits: {} };

describe('applyOverrides — grant', () => {
	it('grant adds a declared feature not in the plan', () => {
		const result = applyOverrides(config, resolvedFree, { grant: ['write'] });
		expect(result.features).toContain('write');
		expect(result.features).toContain('read');
	});

	it('grant of an already-present feature is idempotent', () => {
		const result = applyOverrides(config, resolvedFree, { grant: ['read'] });
		expect(result.features.filter((f) => f === 'read')).toHaveLength(1);
	});

	it('throws InvalidOverrideError for unknown feature in grant', () => {
		expect(() => applyOverrides(config, resolvedFree, { grant: ['nonexistent'] })).toThrow(
			InvalidOverrideError,
		);
	});

	it('unknown feature error carries reason unknown_feature', () => {
		try {
			applyOverrides(config, resolvedFree, { grant: ['ghost'] });
			expect.fail('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(InvalidOverrideError);
			if (err instanceof InvalidOverrideError) {
				expect(err.reason).toBe('unknown_feature');
				expect(err.feature).toBe('ghost');
			}
		}
	});
});

describe('applyOverrides — revoke', () => {
	it('revoke removes a feature from the plan', () => {
		const result = applyOverrides(config, resolvedPro, { revoke: ['export'] });
		expect(result.features).not.toContain('export');
		expect(result.features).toContain('read');
		expect(result.features).toContain('write');
	});

	it('revoke beats inheritance — removes an inherited feature', () => {
		// resolvedPro has 'read' inherited from free; revoke should remove it
		const result = applyOverrides(config, resolvedPro, { revoke: ['read'] });
		expect(result.features).not.toContain('read');
	});

	it('throws InvalidOverrideError for unknown feature in revoke', () => {
		expect(() => applyOverrides(config, resolvedPro, { revoke: ['ghost'] })).toThrow(
			InvalidOverrideError,
		);
	});
});

describe('applyOverrides — grant∩revoke conflict', () => {
	it('throws InvalidOverrideError when same feature appears in grant and revoke', () => {
		expect(() =>
			applyOverrides(config, resolvedFree, { grant: ['write'], revoke: ['write'] }),
		).toThrow(InvalidOverrideError);
	});

	it('conflict error carries reason grant_revoke_conflict', () => {
		try {
			applyOverrides(config, resolvedFree, { grant: ['write'], revoke: ['write'] });
			expect.fail('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(InvalidOverrideError);
			if (err instanceof InvalidOverrideError) {
				expect(err.reason).toBe('grant_revoke_conflict');
				expect(err.feature).toBe('write');
			}
		}
	});
});

describe('applyOverrides — no overrides', () => {
	it('empty overrides object returns equivalent resolved plan', () => {
		const result = applyOverrides(config, resolvedFree, {});
		expect(result.features).toEqual(resolvedFree.features);
	});

	it('preserves limits unchanged', () => {
		const resolved = {
			features: ['read'],
			limits: { seats: { quota: 5, period: 'monthly' as const } },
		};
		const result = applyOverrides(config, resolved, { grant: ['write'] });
		expect(result.limits).toEqual(resolved.limits);
	});
});
