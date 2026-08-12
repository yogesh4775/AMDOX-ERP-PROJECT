# Amdox ERP API Reference

Detailed endpoint paths, methods, request parameters, and response structures.

---

## 1. Authentication
Endpoints require JWT validation headers: `Authorization: Bearer <token>`.

### Login Credentials
- **Endpoint**: `/api/auth/login`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "email": "user@amdox.com",
    "password": "password123"
  }
  ```
- **Response**:
  ```json
  {
    "accessToken": "eyJhb...",
    "refreshToken": "eyJhb..."
  }
  ```

---

## 2. API Keys & Webhooks
- **Generate Key**: `POST /api/admin/api-keys`
- **Rotate Key**: `POST /api/admin/api-keys/:id/rotate`
- **Register Webhook**: `POST /api/admin/webhooks`
