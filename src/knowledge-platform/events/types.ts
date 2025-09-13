// Event sourcing type definitions
// TEST COMMIT: 9617b92 - implementing to satisfy failing tests

export interface DomainEvent {
  id: string;
  aggregateId: string;
  type: string;
  version: number;
  timestamp: Date;
  userId: string;
  payload: Record<string, unknown>;
  metadata: {
    correlationId: string;
    causationId: string;
  };
}

export interface Snapshot {
  id: string;
  aggregateId: string;
  version: number;
  timestamp: Date;
  data: Record<string, unknown>;
}
