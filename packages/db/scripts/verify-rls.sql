-- DistroAI RLS Verification Script
-- Run this against the production database to confirm Row-Level Security is active.

-- Check RLS status on marketing tables
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('MarketingCampaign', 'CampaignMetrics')
ORDER BY c.relname;

-- List all active RLS policies on these tables
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('MarketingCampaign', 'CampaignMetrics')
ORDER BY tablename, policyname;

-- Expected results:
-- 1. Both tables should show rls_enabled = true, rls_forced = true
-- 2. Each table should have at least one policy named like 'org_isolation_*'
-- 3. The policy qual column should reference orgId or a join to the organization

-- If rls_enabled is false, apply the migration:
-- \i packages/db/prisma/migrations/20260417_rls_marketing_tables/migration.sql
