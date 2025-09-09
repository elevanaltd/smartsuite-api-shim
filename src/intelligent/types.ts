export type SafetyLevel = 'GREEN' | 'YELLOW' | 'RED';
export type OperationMode = 'learn' | 'dry_run' | 'execute';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface FailureMode {
  description: string;
  cause: string;
  prevention: string;
  recovery?: string;
  exampleError?: string;
  safeAlternative?: string;
}

export interface SafetyProtocol {
  pattern: RegExp;
  level: SafetyLevel;
  validation?: (payload: any) => void;
  template?: {
    correctPayload?: Record<string, unknown>;
    wrongPayload?: Record<string, unknown>;
  };
  prevention?: string;
}

export interface OperationExample {
  method: HttpMethod;
  endpoint: string;
  payload?: Record<string, unknown>;
  response?: any;
  timestamp: string;
}

export interface ValidationRule {
  type: string;
  limit?: number;
  pattern?: RegExp;
  message: string;
}

export interface OperationTemplate {
  name: string;
  method: HttpMethod;
  endpointPattern: string;
  payloadTemplate: Record<string, unknown>;
  description: string;
}

export interface KnowledgeEntry {
  pattern: RegExp;
  safetyLevel: SafetyLevel;
  protocols?: SafetyProtocol[];
  examples?: OperationExample[];
  failureModes?: FailureMode[];
  validationRules?: ValidationRule[];
  templates?: OperationTemplate[];
}

export interface KnowledgeMatch extends KnowledgeEntry {
  confidence: number;
  matchReason: string;
}

export interface Operation {
  method: HttpMethod;
  endpoint: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface OperationOutcome {
  success: boolean;
  responseTime?: number;
  recordCount?: number;
  error?: string;
  suggestion?: string;
}

export interface IntelligentToolInput {
  mode: OperationMode;
  endpoint: string;
  method: HttpMethod;
  payload?: Record<string, unknown>;
  tableId?: string;
  operation_description: string;
  confirmed?: boolean;
}

export interface OperationResult {
  mode: OperationMode;
  status: 'analyzed' | 'error';
  endpoint: string;
  method: HttpMethod;
  operation_description: string;
  knowledge_applied: boolean;
  safety_assessment?: SafetyAssessment;
  guidance?: string;
  suggested_correction?: any;
  warnings?: string[];
  knowledge_matches?: number;
  performance_ms: number;
  knowledge_version: string;
  error?: string;
}

export interface SafetyAssessment {
  level: SafetyLevel;
  score?: number;
  protocols?: SafetyProtocol[];
  warnings: string[] | Warning[];
  blockers?: string[];
  recommendations?: string[];
  canProceed?: boolean;
  requiresConfirmation?: boolean;
}

export interface Warning {
  level: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  protocol?: string;
}

export interface KnowledgeVersion {
  version: string;
  patternCount: number;
  lastUpdated: string;
  compatibility: string;
}

export interface CacheEntry {
  key: string;
  value: KnowledgeMatch[];
  timestamp: number;
  hits: number;
}

export interface OperationContext {
  isListOperation: boolean;
  isBulkOperation: boolean;
  isFieldOperation: boolean;
  isDeleteOperation: boolean;
  hasPayload: boolean;
  recordCount: number;
}
