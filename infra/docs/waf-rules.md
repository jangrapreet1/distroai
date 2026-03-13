# AWS WAF Configuration Guide
# Apply these rules to the ALB or CloudFront distribution

## Managed Rule Groups (enable all three):
- `AWSManagedRulesCommonRuleSet` — Core protection (XSS, path traversal, etc.)
- `AWSManagedRulesKnownBadInputsRuleSet` — Block Log4j, SSRF, etc.
- `AWSManagedRulesSQLiRuleSet` — SQL injection protection

## Custom Rules:

### 1. Auth Rate Limiting
- Rule name: `auth-rate-limit`
- Match: URI path = `/api/v1/auth/login` OR `/api/v1/auth/register`
- Rate limit: 10 requests per 5 minutes per IP
- Action: Block (return 429)

### 2. SQL Injection in Query Params
- Rule name: `sqli-query-params`
- Match: Query string contains SQL keywords (`SELECT`, `UNION`, `DROP`, `INSERT`, `DELETE`, `UPDATE`)
- Action: Block

### 3. Geo Restriction (optional)
- Rule name: `geo-restrict`
- Allow: IN (India) + common VPN exit countries
- Action: Count (monitor mode initially, switch to Block after validation)

## Terraform implementation:
Add `aws_wafv2_web_acl` resource in `infra/terraform/waf.tf` with the above rules.
Associate with ALB using `aws_wafv2_web_acl_association`.
