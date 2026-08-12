export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  requestStartTime?: number;
  route?: string;
  method?: string;
}
