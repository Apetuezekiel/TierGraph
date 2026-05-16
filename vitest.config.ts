import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		typecheck: {
			enabled: true,
			include: ['tests/**/*.test-d.ts'],
		},
		coverage: {
			provider: 'v8',
			include: ['src/**'],
			exclude: ['src/**/*.test.ts'],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100,
			},
		},
	},
});
