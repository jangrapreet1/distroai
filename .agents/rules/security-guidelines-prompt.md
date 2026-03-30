---
trigger: always_on
---

# DistroAI — Security Guidelines Prompt (IDE Addendum)

This is a security-specific instruction set for working on DistroAI. Apply every rule below across all code written in this project, without needing to be reminded.

---

## Data Backup — Never Lose Data

- Follow the **3-2-1 rule** at all times: 3 copies of data, 2 different storage types, 1 offsite location. When writing any feature that creates or mutates persistent data, think about whether the backup pipeline covers it.
- The backup stack is: **pg_basebackup + WAL-G → Backblaze B2** plus a Hetzner/Hostinger VPS snapshot. Any new data store introduced (Redis, file uploads, etc.) must also have a backup strategy defined before the feature ships.
- **Point-in-Time Recovery (PITR)** is a requirement — use continuous WAL archiving so we can restore to any minute, not just daily snapshots.
- Define **RPO and RTO** for every new critical data store. If an order or ledger entry is lost, that is a business failure for the distributor.
- The following must all be backed up:
  - PostgreSQL DB (orders, ledgers, retailers, inventory, GST records)
  - WhatsApp session files (Baileys session state)
  - User-uploaded files (invoices, PDFs) in object storage
  - Encrypted copy of environment config (not in Git)
  - Redis snapshots if used for queues or session data
- Backups must be **tested weekly on a staging restore** — a backup never tested is a backup that doesn't exist.

---

## Authentication & Access Control

- **Broken Access Control is OWASP #1 (2025).** Every single endpoint must verify the authenticated user has the right to perform the action on the specific resource — not just "are they logged in."
- **Multi-tenant isolation is absolute.** Every DB query touching user data must be scoped by `distributor_id` derived from the server-side auth token — never from client-supplied input. A distributor must never be able to see another distributor's orders, retailers, ledger, or inventory — even accidentally.
- Use **PostgreSQL Row-Level Security (RLS)** as a safety net in addition to application-level scoping. If the app code has a bug, the DB should still block cross-tenant data leaks.
- **Never use sequential integer IDs** in API routes or WhatsApp command responses. Use UUIDs — sequential IDs allow enumeration attacks (`/order/1`, `/order/2`...).
- JWT access tokens must have **short expiry (15–60 min)**. Refresh tokens must be stored in **httpOnly cookies** (not localStorage). Rotate refresh tokens on each use. Invalidate all tokens on password change or logout.
- Enforce **account lockout** after 5–10 failed login attempts with exponential backoff.
- Admin/owner accounts must use **TOTP-based MFA** (not SMS — SIM-swap attacks are real). Distributor users require OTP verification on first login and new device logins.
- Passwords must be hashed with **bcrypt (cost 12+) or argon2id**. Never MD5, SHA-1, or plain SHA-256.
- **Principle of Least Privilege** for all DB roles — the app's DB user must not have DROP, ALTER, or CREATE permissions in production.

---

## API Security & Hacking Prevention

- **Parameterized queries everywhere** — never concatenate user input into SQL. This applies especially to WhatsApp message content that flows into order or ledger queries. Use Drizzle ORM or explicit `$1, $2` placeholders.
- **Input validation on every entry point** — use Zod or Joi schemas. Validate type, length, range, and format. WhatsApp slash command arguments must be validated before any business logic runs.
- **Rate limiting is mandatory** on all endpoints:
  - Login: max 5 attempts per 15 min per IP
  - API endpoints: 100–500 req/min depending on the route
  - Per phone number for WhatsApp commands: prevent one number from spamming the system
  - Use `express-rate-limit` or nginx-level limits as the first layer
- **BOLA/IDOR prevention** — when a distributor requests `/order/:id` or `/retailer/:id`, always verify that the resource belongs to their `distributor_id`. Never trust the ID alone.
- **Verify WhatsApp webhook signatures** using HMAC-SHA256 before processing any inbound message from Meta. Reject unverified requests immediately with a 401.
- Treat every inbound WhatsApp message as **untrusted input** — message content can be crafted to probe your backend. Sanitize before any DB or business logic operation.
- Set the following **security headers** on every response:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy` (restrict script/resource origins)
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **CSRF:** Use CSRF tokens on state-changing requests if using cookie-based auth. If using JWT in Authorization headers, CSRF is not a concern.
- **XSS:** Never use `dangerouslySetInnerHTML`. Escape all user-provided data rendered in HTML.
- **Supply chain (OWASP #3, 2025):** Run `npm audit` regularly. Pin dependency versions in lockfiles. Flag any dependency with a known CVE immediately.

---

## Encryption

- **All traffic over HTTPS/TLS 1.2+ minimum, prefer TLS 1.3.** No plain HTTP in production. Force HTTP → HTTPS redirect. Use Let's Encrypt (Certbot).
- **Disk-level encryption** on the VPS (AES-256). **Encrypted B2/S3 buckets** for all backups (SSE-S3 or SSE-KMS).
- For sensitive fields (payment tokens, any Aadhaar fragments if ever stored), use **column-level encryption via pgcrypto**.
- **Never hardcode secrets** in source code. All credentials go in `.env` via `process.env`. Use Doppler or dotenv-vault for multi-environment management.
- Rotate secrets (JWT secret, DB password, WhatsApp API key) whenever a credential is suspected to be leaked or a team member leaves.
- **Separate secrets per environment** — dev, staging, and production must never share API keys or DB credentials.

---

## Infrastructure Security

- **SSH hardening:** Disable root SSH login. Disable password auth — SSH keys only. Change SSH port from 22. Use fail2ban to auto-block brute-force IPs.
- **Firewall (UFW):** Block all ports by default. Only open 22 (SSH), 80 (HTTP), 443 (HTTPS). PostgreSQL port (5432) must never be exposed to the internet — always connect via localhost or private network.
- **Docker:** Run containers as non-root users. Use read-only filesystems where possible. Scan images with Trivy or `docker scout` before deployment.
- **Nginx in front of the Node app** at all times in production. Disable server version headers. Set request timeouts. Limit client max body size to prevent large payload abuse.
- **Separate environments** — dev and staging must never point to the production DB. Staging uses sanitized/fake data only.
- Keep OS, Node.js, PostgreSQL, and all npm packages updated. Set up Dependabot alerts for security patches.

---

## Monitoring, Logging & Alerting

- **Structured JSON logs** on every meaningful event. Log format must always include: `timestamp`, `level`, `user_id`, `distributor_id`, `action`, `resource_id`, `ip`, `status`, `duration_ms`.
- **Always log:** All auth events (login, logout, failed attempts, MFA). All data mutations (create/update/delete) with who did it and when. All 4xx and 5xx API errors. All WhatsApp message events. All admin actions.
- **Never log:** Raw passwords, full phone numbers (mask to last 4 digits), payment card numbers, Aadhaar numbers, JWT tokens, or any raw secret value.
- **Alerts to configure:**
  - 5+ failed logins from same IP in 10 min
  - Admin login from a new device or location
  - DB query time spikes (possible injection probe or missing index)
  - Server disk > 85%
  - Backup job failure
  - API 5xx error rate spike
- **Uptime monitoring** via UptimeRobot or BetterStack — ping API and DB health check endpoint every 1–5 min. Alert via WhatsApp or SMS on downtime.
- **Fail closed on errors** — if an auth or permission check throws an unexpected error, deny the action. Never fail open.
- Never expose internal error details in API responses. Return `{ success: false, error: { code: "...", message: "..." } }` to the client and log the full detail server-side only.

---

## OWASP Top 10 (2025) — Enforce All of These

1. **Broken Access Control** — tenant-scoped queries + RLS + UUID IDs
2. **Security Misconfiguration** — no default creds, closed ports, no verbose errors in prod
3. **Software Supply Chain Failures** *(new 2025)* — npm audit, lockfiles, Snyk/Dependabot
4. **Cryptographic Failures** — bcrypt, TLS everywhere, encrypted backups, no MD5/SHA-1
5. **Injection** — parameterized queries, Zod validation, sanitize all WhatsApp input
6. **Insecure Design** — question every trust assumption during architecture, threat model new features
7. **Authentication Failures** — MFA, secure JWT, session timeouts, account lockout
8. **Software & Data Integrity Failures** — verify data on ingest, validate checksums on updates
9. **Security Logging & Alerting Failures** — structured logs, real-time alerts, full audit trail
10. **Mishandling of Exceptional Conditions** *(new 2025)* — catch all errors, fail closed, never silently grant access on exception

---

## Feature Completion Checklist — Run This Before Every Commit

- [ ] All DB queries scoped by `distributor_id` from the auth token (never from client input)
- [ ] All user inputs validated with Zod/Joi before any DB or business logic operation
- [ ] No secrets hardcoded anywhere in the codebase
- [ ] Rate limiting applied to any new endpoint
- [ ] Error handling covers all async paths — no unhandled promise rejections
- [ ] API responses never expose stack traces or internal DB errors
- [ ] Any new data store is covered by the backup pipeline
- [ ] WhatsApp webhook signature verified before any message is processed
- [ ] UUIDs used for all resource IDs exposed in APIs or messages
- [ ] Structured logs emit correct fields for all new actions and mutations