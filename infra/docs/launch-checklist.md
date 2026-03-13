# DistroAI Launch Checklist

## Security ✓
- [ ] Multi-tenant isolation tested: org A cannot access org B data (run automated test suite)
- [ ] All endpoints require authentication (run: `grep -r "@Public()" apps/api/src` — verify only auth + webhook routes)
- [ ] Rate limiting active and tested (verify 429 returned on excess requests)
- [ ] HTTPS enforced everywhere (HTTP → HTTPS redirect configured)
- [ ] All secrets in AWS Secrets Manager (zero secrets in code or Docker images)
- [ ] WAF enabled on ALB (CommonRuleSet + SQLiRuleSet + KnownBadInputsRuleSet)
- [ ] Network policies applied (default deny + explicit allow in distroai namespace)
- [ ] Pod security contexts: runAsNonRoot, readOnlyRootFilesystem, drop ALL capabilities
- [ ] OWASP security headers verified (Helmet: HSTS, X-Content-Type-Options, X-Frame-Options)

## Compliance ✓
- [ ] GST invoice legally valid — reviewed by a CA (attach CA review document)
- [ ] E-invoice tested in GSTN sandbox (attach test IRN screenshot)
- [ ] Privacy Policy page live at distroai.in/privacy
- [ ] Terms of Service page live at distroai.in/terms
- [ ] Data Processing Agreement template available for enterprise customers

## Integrations ✓
- [ ] WhatsApp Business Account approved by Meta (not just test number)
- [ ] Razorpay account KYC complete and live (not test mode)
- [ ] SMS (MSG91) DLT registration complete (required for transactional SMS in India)
- [ ] Firebase project configured with correct SHA-1 for Android APK
- [ ] OpenAI API key on paid plan (not free tier)

## Infrastructure ✓
- [ ] Production database on RDS (not Docker)
- [ ] Database backups running and tested (restore drill completed)
- [ ] SSL certificates auto-renewing via cert-manager
- [ ] Monitoring dashboards showing all green (3 dashboards verified)
- [ ] Alerts configured and tested (trigger a fake alert, verify Slack received it)
- [ ] Sentry capturing errors (throw a test error, verify in Sentry dashboard)
- [ ] Status page live at status.distroai.in
- [ ] PgBouncer deployed as connection pooler
- [ ] Redis encryption at rest + in transit enabled
- [ ] ECR image scanning enabled (scan on push)
- [ ] EKS cluster running v1.29 with managed node groups

## Performance ✓
- [ ] Dashboard P95 < 500ms (k6 test result: `k6 run infra/load-tests/test-dashboard.js`)
- [ ] Order creation: 100 concurrent, zero stock corruption (k6 result attached)
- [ ] AI query P95 < 8s (k6 result attached)
- [ ] WhatsApp webhook: 500 concurrent, all return 200 within 2s (k6 result attached)
- [ ] Mobile APK size verified < 30MB
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1 (Lighthouse report attached)

## Business ✓
- [ ] Onboarding wizard tested end-to-end (register → first order → first invoice)
- [ ] 14-day trial auto-starts on registration
- [ ] Upgrade flow tested: trial expires → upgrade modal → Razorpay → plan activates
- [ ] WhatsApp bot tested on 5 real phone numbers (non-Meta test numbers)
- [ ] Daily briefing received on owner's WhatsApp at configured time
- [ ] Payment reminder received after creating an overdue invoice
