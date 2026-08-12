export interface CreateAuditLogDto {
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  requestId?: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
}
