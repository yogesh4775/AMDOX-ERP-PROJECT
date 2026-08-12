# Amdox ERP Rollback & Recovery Procedures

Steps to roll back database migrations and Docker container versions in production.

---

## 1. Database Migrations Rollback
If a Prisma migration deployment fails, execute:
1. Revert to the previous stable release commit branch in source control.
2. Run baseline postgres dump restore from S3 backup:
   ```bash
   ./scripts/restore-db.sh <backup_filename>
   ```

---

## 2. Docker Deployments Rollback
If the live web/backend container deployment experiences runtime failures:
1. Pull the previous stable tag from Docker registry:
   ```bash
   docker-compose down
   docker-compose -f docker-compose.prod.yml pull backend:v1.0.0 frontend:v1.0.0
   docker-compose -f docker-compose.prod.yml up -d
   ```
2. Verify healthy status via container health endpoint queries.
