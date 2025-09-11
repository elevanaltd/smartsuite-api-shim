// TESTGUARD-TDD-GREEN-PHASE: 8d191a2
// Shared types to satisfy test contract

export interface ProjectData {
  id: string;
  eavCode: string;
  dueDate: string;
  newVids: number;
  amendVids: number;
  reuseVids: number;
  projectManager: string;
}

export interface MegaTaskDefinition {
  code: string;
  label: string;
  duration: number;
  assigneeId: string;
  priority: string;
  checklist: string[];
  description: string;
}

export interface ScheduledTask extends MegaTaskDefinition {
  startDate: Date;
  endDate: Date;
  dependencies: {
    predecessors: string[];
    successors: string[];
  };
}

export interface ScheduleResult {
  totalDays: number;
  startDate: string;
  endDate: string;
  tasks: Record<string, { start: Date; end: Date; duration: number }>;
}

export interface MegaTaskFactoryResult {
  success: boolean;
  project: ProjectData;
  tasks: {
    created: ScheduledTask[];  // Tests expect tasks.created structure
  };
  schedule: ScheduleResult;
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
    scheduleValid: boolean;  // Tests expect this field
  };
  error?: string;
}
