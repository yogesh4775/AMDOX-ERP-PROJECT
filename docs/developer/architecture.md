# Amdox ERP Developer Architecture Guide

Technical blueprints for backend APIs, frontend rendering, and monorepo workspace dependencies.

---

## 1. Monorepo Structure
- `apps/backend`: Nest.js server exposing REST APIs.
- `apps/web`: Next.js frontend rendering dynamic pages.
- `packages/database`: Prisma schema definition and migration logs.
- `packages/config`: Common build and runtime environment values.

---

## 2. Infrastructure Flow

```mermaid
graph TD
    Client[Web Browser Client] -->|HTTPS| Proxy[Nginx Reverse Proxy]
    Proxy -->|REST API| Nest[Nest.js Server]
    Proxy -->|Static Pages| Next[Next.js Server]
    Nest -->|Queries| DB[(PostgreSQL)]
    Nest -->|Caching| Cache[(Redis)]
```

---

## 3. Workflow Engine
- Implements state transition pipelines (Draft $\rightarrow$ Pending Approval $\rightarrow$ Confirmed/Rejected).
- Triggers notifications, logs audits events, and runs database transaction lockouts on approval.
