export type Period = 'monthly' | 'yearly' | 'lifetime';

export interface Limit {
	quota: number | null;
	period: Period;
}

export interface PlanInput {
	extends?: string;
	features: string[];
	limits?: Record<string, Limit>;
}

export interface ConfigInput {
	plans: Record<string, PlanInput>;
}

export interface ResolvedPlan {
	features: string[];
	limits: Record<string, Limit>;
}

// Narrow config type that preserves literal unions from static defineConfig calls
export type Config<
	TPlanName extends string = string,
	TFeature extends string = string,
	TLimitKey extends string = string,
> = {
	plans: Record<
		TPlanName,
		{
			extends?: TPlanName;
			features: TFeature[];
			limits?: Record<TLimitKey, Limit>;
		}
	>;
};
