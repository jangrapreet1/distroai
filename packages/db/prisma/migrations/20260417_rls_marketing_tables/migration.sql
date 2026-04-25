-- Phase 11: RLS Policies for Marketing Tables (Security Fix 2)
-- Ensures multi-tenant isolation per OWASP #1 (Broken Access Control)
-- Uses "User"."orgId" scoped queries — auth.uid() resolves to User.id in Supabase

-- ═══════════════════════════════════════════════════
-- MarketingCampaign
-- ═══════════════════════════════════════════════════
ALTER TABLE "MarketingCampaign" ENABLE ROW LEVEL SECURITY;

-- Allow users to access only their org's campaigns
CREATE POLICY "org_isolation_campaigns"
ON "MarketingCampaign"
FOR ALL
USING (
  "orgId" = (
    SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1
  )
);

-- ═══════════════════════════════════════════════════
-- CampaignMetrics
-- ═══════════════════════════════════════════════════
ALTER TABLE "CampaignMetrics" ENABLE ROW LEVEL SECURITY;

-- Allow users to access only metrics belonging to their org's campaigns
CREATE POLICY "org_isolation_metrics"
ON "CampaignMetrics"
FOR ALL
USING (
  "campaignId" IN (
    SELECT "id" FROM "MarketingCampaign"
    WHERE "orgId" = (
      SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1
    )
  )
);
