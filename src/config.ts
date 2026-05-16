import type { ConfigInput } from './types.js';

/**
 * Identity function that preserves literal types from the static config object.
 * Pass a `const`-asserted or inline object literal to get full literal inference.
 */
export function defineConfig<const T extends ConfigInput>(config: T): T {
	return config;
}
