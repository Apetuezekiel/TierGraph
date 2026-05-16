import { InvalidOverrideError } from './errors.js';
import type { ConfigInput, ResolvedPlan } from './types.js';

export interface Overrides {
	grant?: string[];
	revoke?: string[];
}

function getAllDeclaredFeatures(config: ConfigInput): Set<string> {
	const features = new Set<string>();
	for (const plan of Object.values(config.plans)) {
		for (const f of plan.features) {
			features.add(f);
		}
	}
	return features;
}

/**
 * Validates and applies overrides to a resolved plan's effective feature set.
 * Throws InvalidOverrideError for unknown features or grant∩revoke conflicts.
 */
export function applyOverrides(
	config: ConfigInput,
	resolved: ResolvedPlan,
	overrides: Overrides,
): ResolvedPlan {
	const grant = overrides.grant ?? [];
	const revoke = overrides.revoke ?? [];
	const allDeclared = getAllDeclaredFeatures(config);

	// Validate all features in grant and revoke are declared in the config
	for (const f of grant) {
		if (!allDeclared.has(f)) {
			throw new InvalidOverrideError('unknown_feature', f);
		}
	}
	for (const f of revoke) {
		if (!allDeclared.has(f)) {
			throw new InvalidOverrideError('unknown_feature', f);
		}
	}

	// Detect grant ∩ revoke conflicts
	const grantSet = new Set(grant);
	for (const f of revoke) {
		if (grantSet.has(f)) {
			throw new InvalidOverrideError('grant_revoke_conflict', f);
		}
	}

	const revokeSet = new Set(revoke);
	const effectiveFeatures = new Set(resolved.features);

	for (const f of grant) {
		effectiveFeatures.add(f);
	}
	for (const f of revokeSet) {
		effectiveFeatures.delete(f);
	}

	return { features: [...effectiveFeatures], limits: resolved.limits };
}
