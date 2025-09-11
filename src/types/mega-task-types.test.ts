// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';
import type { ScheduleResult, StandardTaskCode } from './mega-task-types.js';

describe('MegaTask Type Definitions', () => {
  it('should define StandardTaskCode type with all required task codes', () => {
    // Type-level test to ensure StandardTaskCode includes all mandatory tasks
    const taskCode: StandardTaskCode = '14_delivery';
    expect(taskCode).toBe('14_delivery');
  });

  it('should define ScheduleResult with guaranteed task codes', () => {
    // This test ensures the type contract guarantees standard tasks exist
    const mockSchedule: ScheduleResult = {
      totalDays: 45,
      startDate: '2025-07-01',
      endDate: '2025-08-15',
      tasks: {
        '01_setup': { start: new Date(), end: new Date(), duration: 1 },
        '02_booking': { start: new Date(), end: new Date(), duration: 1 },
        '03_recce': { start: new Date(), end: new Date(), duration: 1 },
        '04_assets': { start: new Date(), end: new Date(), duration: 1 },
        '05_specs': { start: new Date(), end: new Date(), duration: 1 },
        '06_scripts': { start: new Date(), end: new Date(), duration: 1 },
        '07_review': { start: new Date(), end: new Date(), duration: 1 },
        '08_scenes': { start: new Date(), end: new Date(), duration: 1 },
        '09_voiceover': { start: new Date(), end: new Date(), duration: 1 },
        '10_filming': { start: new Date(), end: new Date(), duration: 1 },
        '11_processing': { start: new Date(), end: new Date(), duration: 1 },
        '12_edit_prep': { start: new Date(), end: new Date(), duration: 1 },
        '13_video_edit': { start: new Date(), end: new Date(), duration: 1 },
        '14_delivery': { start: new Date(), end: new Date(), duration: 1 },
      }
    };
    
    // These should not cause type errors because the tasks are guaranteed to exist
    expect(mockSchedule.tasks['14_delivery']).toBeDefined();
    expect(mockSchedule.tasks['01_setup']).toBeDefined();
  });
});