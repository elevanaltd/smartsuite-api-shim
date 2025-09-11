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

// Standard task codes that are always present in a schedule
export type StandardTaskCode = 
  | '01_setup' | '02_booking' | '03_recce' | '04_assets' 
  | '05_specs' | '06_scripts' | '07_review' | '08_scenes'
  | '09_voiceover' | '10_filming' | '11_processing' | '12_edit_prep'
  | '13_video_edit' | '14_delivery';

export interface TaskScheduleEntry {
  start: Date;
  end: Date;
  duration: number;
}

export interface ScheduleResult {
  totalDays: number;
  startDate: string;
  endDate: string;
  // Guarantee that all standard task codes are always present
  tasks: Record<StandardTaskCode, TaskScheduleEntry> & Record<string, TaskScheduleEntry>;
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
