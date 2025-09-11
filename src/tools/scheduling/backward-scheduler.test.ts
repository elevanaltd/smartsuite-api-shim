// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';

import type { ProjectData } from '../../types/mega-task-types.js';

import { BackwardScheduler } from './backward-scheduler.js';

describe('BackwardScheduler', () => {
  it('should calculate schedule with all standard task codes', () => {
    const scheduler = new BackwardScheduler();
    const projectData: ProjectData = {
      id: 'test-project',
      eavCode: 'EAV007',
      dueDate: '2025-08-15T00:00:00Z',
      newVids: 5,
      amendVids: 0,
      reuseVids: 0,
      projectManager: 'test-pm',
    };

    const result = scheduler.calculateSchedule(projectData);

    // Test that all standard task codes are present
    expect(result.tasks['01_setup']).toBeDefined();
    expect(result.tasks['14_delivery']).toBeDefined();
    expect(result.totalDays).toBeGreaterThan(0);
  });
});
