export class AccessDeniedError extends Error {
	readonly name = 'AccessDeniedError';
	readonly feature: string;
	readonly plan: string;
	readonly requiredPlans: string[];

	constructor(feature: string, plan: string, requiredPlans: string[]) {
		super(`Access denied: feature "${feature}" is not available on plan "${plan}"`);
		this.feature = feature;
		this.plan = plan;
		this.requiredPlans = requiredPlans;
		// Restore prototype chain so instanceof works across module boundaries
		Object.setPrototypeOf(this, new.target.prototype);
	}

	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			feature: this.feature,
			plan: this.plan,
			requiredPlans: this.requiredPlans,
		};
	}
}

export class InvalidOverrideError extends Error {
	readonly name = 'InvalidOverrideError';
	readonly reason: 'unknown_feature' | 'grant_revoke_conflict';
	readonly feature: string;

	constructor(reason: 'unknown_feature' | 'grant_revoke_conflict', feature: string) {
		const message =
			reason === 'grant_revoke_conflict'
				? `Feature "${feature}" appears in both grant and revoke — conflict must be resolved`
				: `Feature "${feature}" is not declared in the config`;
		super(message);
		this.reason = reason;
		this.feature = feature;
		Object.setPrototypeOf(this, new.target.prototype);
	}

	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			reason: this.reason,
			feature: this.feature,
		};
	}
}
