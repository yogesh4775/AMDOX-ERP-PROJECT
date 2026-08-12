# Amdox ERP Release & Production Deployment Checklist

Deployment validation checks, environment parameters setup, and smoke tests.

---

## 1. Environment & Setup Checklist
- [x] Configure production environment file variables (`DATABASE_URL`, `REDIS_HOST`, `JWT_SECRET`).
- [x] Run Docker Compose stack build sequence:
  ```bash
  docker-compose up --build -d
  ```
- [x] Run database migrations:
  ```bash
  prisma migrate deploy
  ```

---

## 2. Release QA Validation
- [x] Verify Nginx reverse proxy routes resolve both static pages and Nest.js `/api` requests.
- [x] Validate MFA codes login flow completes successfully.
- [x] Verify CPU monitoring metrics render correctly in the Admin Dashboard.
