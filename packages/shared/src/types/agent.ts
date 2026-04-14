export type AgentName = 'orchestrator' | 'schema' | 'ui' | 'query' | 'file' | 'logic' | 'test';

export type UserRole = 'admin' | 'builder' | 'user';

export interface AgentResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface AgentPermission {
  agent: AgentName;
  db: ('ddl' | 'select' | 'insert' | 'update' | 'delete' | 'none')[];
  view: 'read' | 'readwrite' | 'none';
  file: 'read' | 'readwrite' | 'none';
  allowed_by_roles: UserRole[];
}

export const AGENT_PERMISSIONS: AgentPermission[] = [
  { agent: 'orchestrator', db: ['none'],                       view: 'read',      file: 'none',      allowed_by_roles: ['admin', 'builder', 'user'] },
  { agent: 'schema',       db: ['ddl'],                        view: 'none',      file: 'none',      allowed_by_roles: ['admin', 'builder'] },
  { agent: 'ui',           db: ['none'],                       view: 'readwrite', file: 'none',      allowed_by_roles: ['admin', 'builder'] },
  { agent: 'query',        db: ['select'],                     view: 'none',      file: 'none',      allowed_by_roles: ['admin', 'builder', 'user'] },
  { agent: 'file',         db: ['insert'],                     view: 'none',      file: 'readwrite', allowed_by_roles: ['admin', 'builder', 'user'] },
  { agent: 'logic',        db: ['select', 'insert', 'update'], view: 'none',      file: 'none',      allowed_by_roles: ['admin', 'builder'] },
  { agent: 'test',         db: ['select'],                     view: 'read',      file: 'none',      allowed_by_roles: ['admin', 'builder'] },
];
