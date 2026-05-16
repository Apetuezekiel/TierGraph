import { describe, expect, it } from 'vitest';

describe('public exports', () => {
	it('exports all public symbols', async () => {
		const mod = await import('./index.js');
		expect(typeof mod.defineConfig).toBe('function');
		expect(typeof mod.createAccess).toBe('function');
		expect(typeof mod.AccessDeniedError).toBe('function');
		expect(typeof mod.InvalidOverrideError).toBe('function');
	});
});
