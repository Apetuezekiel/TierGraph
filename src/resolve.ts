import type { ConfigInput, Limit, ResolvedPlan } from './types.js';

export class CircularExtendsError extends Error {
	readonly name = 'CircularExtendsError';
	constructor(chain: string[]) {
		super(`Circular extends detected: ${chain.join(' → ')}`);
	}
}

export class UnknownPlanError extends Error {
	readonly name = 'UnknownPlanError';
	constructor(plan: string, referencedBy?: string) {
		super(
			referencedBy !== undefined
				? `Plan "${plan}" referenced in extends of "${referencedBy}" does not exist`
				: `Plan "${plan}" does not exist`,
		);
	}
}

/**
 * Walks the extends chain for `planName` and returns the fully merged
 * effective feature set and limits. Ancestor values are base; descendants
 * override limits and accumulate features.
 */
export function resolvePlan(config: ConfigInput, planName: string): ResolvedPlan {
	if (config.plans[planName] === undefined) {
		throw new UnknownPlanError(planName);
	}

	// Tracks the current DFS path to detect cycles
	const onPath = new Set<string>();

	function walk(name: string, referencedBy: string): ResolvedPlan {
		if (onPath.has(name)) {
			throw new CircularExtendsError([...onPath, name]);
		}

		const plan = config.plans[name];
		if (plan === undefined) {
			throw new UnknownPlanError(name, referencedBy);
		}

		onPath.add(name);

		let base: ResolvedPlan = { features: [], limits: {} };

		if (plan.extends !== undefined) {
			base = walk(plan.extends, name);
		}

		// Accumulate features (ancestor + current, deduplicated)
		const featureSet = new Set([...base.features, ...plan.features]);

		// Descendant limits override ancestor limits on the same key
		const limits: Record<string, Limit> = { ...base.limits, ...(plan.limits ?? {}) };

		onPath.delete(name);

		return { features: [...featureSet], limits };
	}

	return walk(planName, planName);
}
