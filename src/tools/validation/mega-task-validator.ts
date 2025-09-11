// TESTGUARD-TDD-GREEN-PHASE: 8d191a2
// MegaTaskValidator implementation to satisfy test contract

import type { MegaTaskDefinition } from '../../types/mega-task-types.js';

// Local type definition to avoid circular dependency
interface ProjectData {
  id: string;
  eavCode: string;
  dueDate: string;
  newVids: number;
  amendVids: number;
  reuseVids: number;
  projectManager: string;
}

export class MegaTaskValidator {
  validateProjectData(project: any): void {
    if (!project.eavCode) {
      throw new Error('Missing required field: eavCode');
    }
    
    if (project.newVids < 0 || project.amendVids < 0 || project.reuseVids < 0) {
      throw new Error('Video counts must be non-negative');
    }
  }

  validateTaskDefinitions(tasks: MegaTaskDefinition[]): void {
    const requiredCodes = [
      '01_setup', '02_booking', '03_recce', '04_assets', '05_specs',
      '06_scripts', '07_review', '08_scenes', '09_voiceover', '10_filming',
      '11_processing', '12_edit_prep', '13_video_edit', '14_delivery'
    ];
    
    const providedCodes = tasks.map(t => t.code);
    const missing = requiredCodes.filter(code => !providedCodes.includes(code));
    
    if (missing.length > 0) {
      throw new Error('Missing required task codes');
    }
  }
}
