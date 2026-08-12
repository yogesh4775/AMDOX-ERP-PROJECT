# Amdox ERP Security Compliance Checklist

Security parameters for authentication, tenant isolation, and api keys protections.

---

## 1. Authentication & Session Control
- [x] **JWT Expirations**: Active access token expiration set to 15 minutes; refresh tokens configured.
- [x] **MFA Enforcement**: Enable TOTP checks for users on sign-in.
- [x] **Rate Limits**: Requests capped at 100 per minute per IP for base auth endpoints.

---

## 2. Infrastructure & Data Protection
- [x] **Tenant Isolation**: Row-level filtering checking target `tenantId` parameter on database queries.
- [x] **API Rotation**: API key rotating mechanism revokes stale access keys.
- [x] **Encrypted Backups**: Dumps encrypted using AES-256 prior to S3 upload.
