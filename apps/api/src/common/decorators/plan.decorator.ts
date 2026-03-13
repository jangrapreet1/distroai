import { SetMetadata } from '@nestjs/common';
import { PlanName, FeatureName } from '../config/plan-limits.config';

export const REQUIRES_PLAN_KEY = 'requiresPlan';
export const REQUIRES_FEATURE_KEY = 'requiresFeature';

export const RequiresPlan = (plan: PlanName) => SetMetadata(REQUIRES_PLAN_KEY, plan);
export const RequiresFeature = (feature: FeatureName) => SetMetadata(REQUIRES_FEATURE_KEY, feature);
