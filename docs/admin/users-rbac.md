# Amdox ERP Administrator Guide

This guide covers tenant governance, role mappings, backups management, and monitoring metrics.

---

## 1. User & Role Governance
- **Creating users**: Add user record entries, mapping them to standard roles (SUPER_ADMIN, MANAGER, STAFF).
- **Permissions matrix**: Enable/disable checkboxes to match resource scopes (e.g. Leads, Backups, GL_Ledger) with roles.

---

## 2. Backup & Restore Operations
- **Database Backup**: Runs the pg_dump compression script. Saves encrypted output files to S3-compatible versioned containers.
- **Database Restore**: Decrypts the target dump utilizing OpenSSL and restores database instances.

---

## 3. Server Health Monitoring
- Monitor active CPU levels, Memory allocations, and database connectivity.
- Check active background queue lists and cron schedules.
