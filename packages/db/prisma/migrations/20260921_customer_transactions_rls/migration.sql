-- Phase 12: RLS Policies for Customer Transactions
-- Ensures multi-tenant isolation per OWASP #1 (Broken Access Control)
-- Uses "User"."orgId" scoped queries — auth.uid() resolves to User.id in Supabase

-- ═══════════════════════════════════════════════════
-- 1. CustomerTransaction RLS
-- ═══════════════════════════════════════════════════
ALTER TABLE "CustomerTransaction" ENABLE ROW LEVEL SECURITY;

-- Allow users to access and mutate only their org's transactions
CREATE POLICY "org_isolation_customer_transactions"
ON "CustomerTransaction"
FOR ALL
USING (
  "orgId" = (
    SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1
  )
)
WITH CHECK (
  "orgId" = (
    SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1
  )
);

-- ═══════════════════════════════════════════════════
-- 2. CustomerTransactionItem RLS
-- ═══════════════════════════════════════════════════
ALTER TABLE "CustomerTransactionItem" ENABLE ROW LEVEL SECURITY;

-- Allow users to access and mutate only items linked to their org's transactions
CREATE POLICY "org_isolation_customer_transaction_items"
ON "CustomerTransactionItem"
FOR ALL
USING (
  "transactionId" IN (
    SELECT "id" FROM "CustomerTransaction"
    WHERE "orgId" = (
      SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1
    )
  )
)
WITH CHECK (
  "transactionId" IN (
    SELECT "id" FROM "CustomerTransaction"
    WHERE "orgId" = (
      SELECT "orgId" FROM "User" WHERE "id" = auth.uid() LIMIT 1
    )
  )
);
