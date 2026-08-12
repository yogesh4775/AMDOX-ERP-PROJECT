# Amdox ERP Database Schematics & Relationships

Entities relationships and database tables indices definitions.

---

## 1. Schema ER Model

```mermaid
erDiagram
    Tenant ||--o{ User : owns
    Tenant ||--o{ Company : registers
    Tenant ||--o{ Product : catalog
    Tenant ||--o{ Warehouse : inventory
    User ||--o{ UserRole : assigns
    Role ||--o{ RolePermission : map
```

---

## 2. Seed & Migration Strategies
- **Migrations**: Incremental schema updates executed via Prisma migrate CLI (`prisma migrate deploy`).
- **Seeders**: Seed system permissions first, then execute `demo-seeder.ts` to construct the testing ecosystem.
