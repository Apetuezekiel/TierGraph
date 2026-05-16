import { AccessDeniedError } from './errors.js';
import { applyOverrides } from './overrides.js';
import type { Overrides } from './overrides.js';
import { resolvePlan } from './resolve.js';
import type { ConfigInput, Limit } from './types.js';

export interface DiffResult {
	gains: string[];
	limitUpgrades: Record<string, { from: number | null; to: number | null }>;
}

export interface AccessChecker {
	can(feature: string): boolean;
	cannot(feature: string): boolean;
	guard(feature: string): void;
	diff(targetPlan: string): DiffResult;
}

export interface CreateAccessOptions {
	plan: string;
	overrides?: Overrides;
}

export function createAccess(config: ConfigInput, options: CreateAccessOptions): AccessChecker {
	const { plan: planName, overrides } = options;

	const resolved = resolvePlan(config, planName);
	const effective =
		overrides !== undefined ? applyOverrides(config, resolved, overrides) : resolved;

	const effectiveFeatureSet = new Set(effective.features);

	function computeRequiredPlans(feature: string): string[] {
		return Object.keys(config.plans).filter((p) => {
			try {
				const r = resolvePlan(config, p);
				return r.features.includes(feature);
			} catch {
				return false;
			}
		});
	}

	return {
		can(feature: string): boolean {
			return effectiveFeatureSet.has(feature);
		},

		cannot(feature: string): boolean {
			return !effectiveFeatureSet.has(feature);
		},

		guard(feature: string): void {
			if (!effectiveFeatureSet.has(feature)) {
				throw new AccessDeniedError(feature, planName, computeRequiredPlans(feature));
			}
		},

		diff(targetPlan: string): DiffResult {
			const targetResolved = resolvePlan(config, targetPlan);

			// gains: features in target that aren't in the current effective set
			const gains = targetResolved.features.filter((f) => !effectiveFeatureSet.has(f));

			// limitUpgrades: limits where the quota differs between current effective and target
			const limitUpgrades: Record<string, { from: number | null; to: number | null }> = {};
			const currentLimits: Record<string, Limit> = effective.limits;
			const targetLimits: Record<string, Limit> = targetResolved.limits;

			const allLimitKeys = new Set([...Object.keys(currentLimits), ...Object.keys(targetLimits)]);

			for (const key of allLimitKeys) {
				const from = currentLimits[key]?.quota ?? null;
				const to = targetLimits[key]?.quota ?? null;
				if (from !== to) {
					limitUpgrades[key] = { from, to };
				}
			}

			return { gains, limitUpgrades };
		},
	};
}
