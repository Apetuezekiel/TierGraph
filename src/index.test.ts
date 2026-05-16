import { describe, expect, it } from 'vitest';

describe('public exports', () => {
	it('exports defineConfig', async () => {
		const mod = await import('./index.js');
		expect(typeof mod.defineConfig).toBe('function');
	});
});
