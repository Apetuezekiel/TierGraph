import { describe, expect, it } from 'vitest';
import { defineConfig } from './config.js';

describe('defineConfig', () => {
	it('returns the config object unchanged (identity)', () => {
		const cfg = defineConfig({
			plans: {
				free: { features: ['read'] },
				pro: { features: ['read', 'write'] },
			},
		});
		expect(cfg.plans.free.features).toEqual(['read']);
		expect(cfg.plans.pro.features).toEqual(['read', 'write']);
	});

	it('preserves limits on plans', () => {
		const cfg = defineConfig({
			plans: {
				pro: {
					features: ['export'],
					limits: { seats: { quota: 5, period: 'monthly' } },
				},
			},
		});
		expect(cfg.plans.pro.limits?.seats).toEqual({ quota: 5, period: 'monthly' });
	});

	it('preserves extends field', () => {
		const cfg = defineConfig({
			plans: {
				free: { features: ['read'] },
				pro: { extends: 'free', features: ['write'] },
			},
		});
		expect(cfg.plans.pro.extends).toBe('free');
	});

	it('preserves null quota', () => {
		const cfg = defineConfig({
			plans: {
				enterprise: {
					features: ['all'],
					limits: { seats: { quota: null, period: 'yearly' } },
				},
			},
		});
		expect(cfg.plans.enterprise.limits?.seats.quota).toBeNull();
	});
});
