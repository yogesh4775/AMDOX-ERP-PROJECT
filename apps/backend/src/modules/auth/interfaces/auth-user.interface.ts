export interface AuthUser {
  id: string;
  sessionId: string;
  tokenId: string;
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
}
