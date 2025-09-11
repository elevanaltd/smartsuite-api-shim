// TESTGUARD_BYPASS: TDD-RED-001 - Writing failing tests first per TDD discipline
// Critical-Engineer: consulted for test architecture patterns
// Context7: consulted for vitest and jest-like testing patterns
// TESTGUARD-APPROVED: Removing unused imports after type strengthening

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { SmartSuiteClient } from '../smartsuite-client.js';
import type { ProjectData, MegaTaskDefinition } from '../types/mega-task-types.js';

import { ChecklistFormatter } from './formatting/checklist-formatter.js';
import { MegaTaskFactory } from './mega-task-factory.js';
import { BackwardScheduler } from './scheduling/backward-scheduler.js';
import { MegaTaskValidator } from './validation/mega-task-validator.js';

describe('MegaTaskFactory', () => {
  let factory: MegaTaskFactory;
  let mockClient: SmartSuiteClient;

  beforeEach(() => {
    mockClient = {
      getRecord: vi.fn(),
      createRecord: vi.fn(),
      updateRecord: vi.fn(),
      bulkCreate: vi.fn(),
      bulkUpdate: vi.fn(),
      getSchema: vi.fn(),
      listRecords: vi.fn(),
      deleteRecord: vi.fn(),
      countRecords: vi.fn(),
    } as unknown as SmartSuiteClient;

    factory = new MegaTaskFactory(mockClient);
  });

  describe('createMegaTaskWorkflow', () => {
    it('should fail - RED phase: create complete workflow in dry-run mode', async () => {
      // This test should fail because implementation doesn't exist yet
      const projectId = '68abcd3975586ee1ff3e5b1f';

      // Mock project data response
      vi.mocked(mockClient.getRecord).mockResolvedValue({
        id: projectId,
        eavcode: 'EAV007',
        projdue456: { to_date: '2025-11-15T00:00:00Z' }, // 2+ months from now
        newvidcount: 7,
        amendvidscount: 0,
        reusevidscount: 0,
        assigned_to: ['66fa7af64b11acf6780c4436'],
      });

      const result = await factory.createMegaTaskWorkflow({
        project_id: projectId,
        mode: 'dry_run',
      });

      expect(result.success).toBe(true);
      expect(result.project.eavCode).toBe('EAV007');
      expect(result.project.newVids).toBe(7);
      expect(result.tasks.created).toHaveLength(14); // Standard workflow
      expect(result.validation.scheduleValid).toBe(true);
      expect(result.schedule.totalDays).toBeGreaterThan(40);
    });

    it('should fail - RED phase: create workflow with conditional tasks', async () => {
      const projectId = '68abcd3975586ee1ff3e5b1f';

      // Mock project with reuse videos
      vi.mocked(mockClient.getRecord).mockResolvedValue({
        id: projectId,
        eavcode: 'EAV008',
        projdue456: { to_date: '2025-09-01T00:00:00Z' },
        newvidcount: 5,
        amendvidscount: 2,
        reusevidscount: 3,
        assigned_to: ['66fa7af64b11acf6780c4436'],
      });

      const result = await factory.createMegaTaskWorkflow({
        project_id: projectId,
        mode: 'dry_run',
      });

      expect(result.tasks.created).toHaveLength(15); // 14 standard + 1 reuse_review
      expect(result.tasks.created.some(task => task.code === 'reuse_review')).toBe(true);
    });

    it('should fail - RED phase: execute mode creates actual tasks', async () => {
      const projectId = '68abcd3975586ee1ff3e5b1f';

      vi.mocked(mockClient.getRecord).mockResolvedValue({
        id: projectId,
        eavcode: 'EAV009',
        projdue456: { to_date: '2025-07-30T00:00:00Z' },
        newvidcount: 3,
        amendvidscount: 0,
        reusevidscount: 0,
        assigned_to: ['66fa7af64b11acf6780c4436'],
      });

      // Mock successful bulk creation
      vi.mocked(mockClient.bulkCreate).mockResolvedValue({
        items: Array.from({ length: 14 }, (_, i) => ({
          id: `68cd1234abcd5678ef90123${i}`,
          task12code: `${String(i + 1).padStart(2, '0')}_${['setup', 'booking', 'recce'][i] || 'task'}`,
          title: `EAV009: Task ${i + 1}`,
        })),
      });

      vi.mocked(mockClient.bulkUpdate).mockResolvedValue({
        items: [],
      });

      const result = await factory.createMegaTaskWorkflow({
        project_id: projectId,
        mode: 'execute',
      });

      expect(result.success).toBe(true);
      expect(mockClient.bulkCreate).toHaveBeenCalledWith('68c24591b7d2aad485e8f781', expect.any(Object));
      expect(mockClient.bulkUpdate).toHaveBeenCalledWith('68c24591b7d2aad485e8f781', expect.any(Object));
    });

    it('should warn but succeed for tight timeline schedules', async () => {
      const projectId = '68abcd3975586ee1ff3e5b1f';

      // Mock project with very tight timeline (due tomorrow)
      vi.mocked(mockClient.getRecord).mockResolvedValue({
        id: projectId,
        eavcode: 'EAV010',
        projdue456: { to_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, // Tomorrow
        newvidcount: 10,
        amendvidscount: 0,
        reusevidscount: 0,
        assigned_to: ['66fa7af64b11acf6780c4436'],
      });

      const result = await factory.createMegaTaskWorkflow({
        project_id: projectId,
        mode: 'execute',
      });

      // Should succeed with warning, not throw error
      expect(result.success).toBe(true);
      expect(result.validation.scheduleValid).toBe(false);
      expect(result.validation.warnings).toBeDefined();
    });
  });
});

describe('BackwardScheduler', () => {
  let scheduler: BackwardScheduler;

  beforeEach(() => {
    scheduler = new BackwardScheduler();
  });

  describe('calculateSchedule', () => {
    it('should fail - RED phase: calculate backward schedule from due date', () => {
      const projectData: ProjectData = {
        id: '68abcd3975586ee1ff3e5b1f',
        eavCode: 'EAV007',
        dueDate: '2025-08-15T00:00:00Z',
        newVids: 7,
        amendVids: 0,
        reuseVids: 0,
        projectManager: '66fa7af64b11acf6780c4436',
      };

      const schedule = scheduler.calculateSchedule(projectData);

      expect(schedule.tasks).toHaveProperty('14_delivery');
      expect(schedule.tasks['14_delivery'].end).toBe('2025-08-15');
      expect(schedule.tasks).toHaveProperty('01_setup');
      expect(schedule.tasks['01_setup'].start).toBeTruthy();
      expect(schedule.totalDays).toBeGreaterThan(40);
    });

    it('should fail - RED phase: handle 3-way convergence at edit prep', () => {
      const projectData: ProjectData = {
        id: '68abcd3975586ee1ff3e5b1f',
        eavCode: 'EAV007',
        dueDate: '2025-08-15T00:00:00Z',
        newVids: 5,
        amendVids: 0,
        reuseVids: 0,
        projectManager: '66fa7af64b11acf6780c4436',
      };

      const schedule = scheduler.calculateSchedule(projectData);

      // Edit prep should wait for all three dependencies
      const editPrep = schedule.tasks['12_edit_prep'];
      const assets = schedule.tasks['04_assets'];
      const voiceover = schedule.tasks['09_voiceover'];
      const processing = schedule.tasks['11_processing'];

      expect(editPrep.start.getTime()).toBeGreaterThanOrEqual(assets.end.getTime());
      expect(editPrep.start.getTime()).toBeGreaterThanOrEqual(voiceover.end.getTime());
      expect(editPrep.start.getTime()).toBeGreaterThanOrEqual(processing.end.getTime());
    });

    it('should fail - RED phase: calculate dynamic filming duration based on video count', () => {
      const projectData: ProjectData = {
        id: '68abcd3975586ee1ff3e5b1f',
        eavCode: 'EAV007',
        dueDate: '2025-08-15T00:00:00Z',
        newVids: 15, // Large project
        amendVids: 5,
        reuseVids: 0,
        projectManager: '66fa7af64b11acf6780c4436',
      };

      const schedule = scheduler.calculateSchedule(projectData);

      const filming = schedule.tasks['10_filming'];
      expect(filming.duration).toBeGreaterThan(3); // Should scale with video count
      expect(filming.duration).toBe(Math.max(Math.ceil(20 * 0.2), 1)); // newVids + amendVids = 20, 0.2 days per video
    });
  });

  describe('validateScheduleFitsTimeline', () => {
    it('should fail - RED phase: return validation errors for impossible schedules', () => {
      const projectData: ProjectData = {
        id: '68abcd3975586ee1ff3e5b1f',
        eavCode: 'EAV007',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        newVids: 10,
        amendVids: 0,
        reuseVids: 0,
        projectManager: '66fa7af64b11acf6780c4436',
      };

      const schedule = scheduler.calculateSchedule(projectData);
      const validation = scheduler.validateScheduleFitsTimeline(schedule, projectData);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => /extends.*days past due/.test(issue))).toBe(true);
    });
  });
});

describe('MegaTaskValidator', () => {
  let validator: MegaTaskValidator;

  beforeEach(() => {
    validator = new MegaTaskValidator();
  });

  describe('validateProjectData', () => {
    it('should fail - RED phase: validate required project fields', () => {
      const invalidProject = {
        id: '68abcd3975586ee1ff3e5b1f',
        // Missing required fields
      };

      expect(() => validator.validateProjectData(invalidProject)).toThrow('Missing required field: eavCode');
    });

    it('should fail - RED phase: validate video counts are non-negative', () => {
      const invalidProject = {
        id: '68abcd3975586ee1ff3e5b1f',
        eavCode: 'EAV007',
        dueDate: '2025-08-15T00:00:00Z',
        newVids: -1, // Invalid
        amendVids: 0,
        reuseVids: 0,
        projectManager: '66fa7af64b11acf6780c4436',
      };

      expect(() => validator.validateProjectData(invalidProject)).toThrow('Video counts must be non-negative');
    });
  });

  describe('validateTaskDefinitions', () => {
    it('should fail - RED phase: ensure all required task codes are present', () => {
      const incompleteTasks: MegaTaskDefinition[] = [
        {
          code: '01_setup',
          label: '01-SETUP',
          description: 'Initial project setup',
          duration: 3,
          assigneeId: '66fa7af64b11acf6780c4436',
          priority: 'high',
          checklist: [],
        },
        // Missing other required tasks
      ];

      expect(() => validator.validateTaskDefinitions(incompleteTasks)).toThrow('Missing required task codes');
    });
  });
});

describe('ChecklistFormatter', () => {
  let formatter: ChecklistFormatter;

  beforeEach(() => {
    formatter = new ChecklistFormatter();
  });

  describe('formatChecklistToSmartDocFormat', () => {
    it('should fail - RED phase: convert simple text to SmartDoc rich text format', () => {
      const simpleChecklist = [
        'Agreement signed and finalized',
        'All videos added and production types confirmed',
      ];

      const formatted = formatter.formatChecklistToSmartDocFormat(
        simpleChecklist,
        'TASK001',
      );

      expect(formatted.items).toHaveLength(2);
      expect(formatted.items[0]).toHaveProperty('data');
      expect(formatted.items[0]?.data).toHaveProperty('type', 'doc');
      expect(formatted.items[0]?.data).toHaveProperty('content');
      expect(formatted.items[0]).toHaveProperty('html');
      expect(formatted.items[0]).toHaveProperty('preview');
      // assignee and due_date are not part of SmartDocFormat
    });

    it('should fail - RED phase: handle dynamic checklist for video editing tasks', () => {
      const videos = [
        { title: 'Introduction Video' },
        { title: 'Setup Guide' },
        { title: 'Advanced Features' },
      ];

      const formatted = formatter.formatDynamicVideoChecklist(
        videos,
        'TASK001',
      );

      expect(formatted.items).toHaveLength(3);
      // TESTGUARD-APPROVED: TESTGUARD-20250911-c9ed4278
      formatted.items.forEach((item, index) => {
        const video = videos[index];
        if (!video) {
          throw new Error(`Test integrity failure: No video found at index ${index}, but a formatted item exists. The arrays are out of sync.`);
        }
        expect(item.preview).toContain(video.title);
        expect(item.preview).toContain('PENDING');
      });
    });
  });

  describe('buildMegaTaskPayload', () => {
    it('should fail - RED phase: build complete task payload with all required fields', () => {
      const taskDef: MegaTaskDefinition = {
        code: '01_setup',
        label: '01-SETUP',
        duration: 3,
        description: 'Initial project setup and verification',
        assigneeId: '66fa7af64b11acf6780c4436',
        priority: 'high',
        checklist: [
          'Agreement signed and finalized',
          'All videos added and production types confirmed',
        ],
      };

      const projectData: ProjectData = {
        id: '68abcd3975586ee1ff3e5b1f',
        eavCode: 'EAV007',
        dueDate: '2025-08-15T00:00:00Z',
        newVids: 7,
        amendVids: 0,
        reuseVids: 0,
        projectManager: '66fa7af64b11acf6780c4436',
      };


      const payload = formatter.buildMegaTaskPayload(taskDef, projectData);

      expect(payload.title).toBe('EAV007: 01-SETUP | Danny Hughes');
      expect(payload.task12code).toBe('01_setup');
      expect(payload.assigned_to).toEqual(['66fa7af64b11acf6780c4436']);
      expect(payload.projid1234).toEqual(['68abcd3975586ee1ff3e5b1f']);
      expect(payload.due_date).toEqual({
        from_date: '2025-06-02T00:00:00Z',
        to_date: '2025-06-04T00:00:00Z',
      });
      expect(payload.priority).toBe('high');
      expect(payload.checklist99).toBeDefined();
      expect(payload.checklist99.items).toHaveLength(2);
    });
  });
});

describe('MegaTaskFactory Integration', () => {
  let factory: MegaTaskFactory;
  let mockClient: SmartSuiteClient;

  beforeEach(() => {
    mockClient = {
      getRecord: vi.fn(),
      bulkCreate: vi.fn(),
      bulkUpdate: vi.fn(),
    } as unknown as SmartSuiteClient;

    factory = new MegaTaskFactory(mockClient);
  });

//   describe('buildDependencyChain', () => {
//     it('should fail - RED phase: create proper dependency relationships', () => {
//       const taskIdMap = new Map([
//         ['01_setup', '68cd1234abcd5678ef901234'],
//         ['02_booking', '68cd1234abcd5678ef901235'],
//         ['03_recce', '68cd1234abcd5678ef901236'],
//         ['12_edit_prep', '68cd1234abcd5678ef901246'],
//         ['04_assets', '68cd1234abcd5678ef901237'],
//         ['09_voiceover', '68cd1234abcd5678ef901242'],
//         ['11_processing', '68cd1234abcd5678ef901244']
//       ]);
//
//       const dependencies = factory.buildDependencyChain(taskIdMap);
//
//       // Find 12_edit_prep dependency
//       const editPrepDep = dependencies.find(d => d.id === '68cd1234abcd5678ef901246');
//       expect(editPrepDep).toBeDefined();
//       expect(editPrepDep!.dependency.predecessor).toHaveLength(3);
//       expect(editPrepDep!.dependency.predecessor).toEqual(
//         expect.arrayContaining([
//           expect.objectContaining({ record: '68cd1234abcd5678ef901237' }), // assets
//           expect.objectContaining({ record: '68cd1234abcd5678ef901242' }), // voiceover
//           expect.objectContaining({ record: '68cd1234abcd5678ef901244' })  // processing
//         ])
//       );
//     });
//
//     it('should fail - RED phase: handle finish-to-start dependencies with no lag', () => {
//       const taskIdMap = new Map([
//         ['01_setup', '68cd1234abcd5678ef901234'],
//         ['02_booking', '68cd1234abcd5678ef901235']
//       ]);
//
//       const dependencies = factory.buildDependencyChain(taskIdMap);
//       const bookingDep = dependencies.find(d => d.id === '68cd1234abcd5678ef901235');
//
//       expect(bookingDep!.dependency.predecessor[0]).toEqual(
//         expect.objectContaining({
//           type: 'fs',
//           lag: 0,
//           application: '68c24591b7d2aad485e8f781',
//           record: '68cd1234abcd5678ef901234'
//         })
//       );
//     });
//   });

  describe('error handling', () => {
    it('should fail - RED phase: handle missing project data', async () => {
      vi.mocked(mockClient.getRecord).mockRejectedValue(new Error('Record not found'));

      await expect(factory.createMegaTaskWorkflow({
        project_id: 'nonexistent',
        mode: 'dry_run',
      })).rejects.toThrow('Record not found');
    });

    it('should fail - RED phase: handle API failures gracefully', async () => {
      vi.mocked(mockClient.getRecord).mockResolvedValue({
        id: '68abcd3975586ee1ff3e5b1f',
        eavcode: 'EAV007',
        projdue456: { to_date: '2025-11-15T00:00:00Z' }, // 2+ months from now
        newvidcount: 7,
        amendvidscount: 0,
        reusevidscount: 0,
        assigned_to: ['66fa7af64b11acf6780c4436'],
      });

      vi.mocked(mockClient.bulkCreate).mockRejectedValue(new Error('API Error'));

      const result = await factory.createMegaTaskWorkflow({
        project_id: '68abcd3975586ee1ff3e5b1f',
        mode: 'execute',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Error');
    });
  });

  describe('createTasksInBatches', () => {
    it('should fail - RED phase: batch tasks into groups of 15 with success tracking', async () => {
      const tasks = Array.from({ length: 35 }, (_, i) => ({
        title: `Task ${i + 1}`,
        task12code: `task_${String(i + 1).padStart(3, '0')}`,
        assignedTo: ['66fa7af64b11acf6780c4436'],
      }));

      // Mock successful batch creation responses
      vi.mocked(mockClient.bulkCreate)
        .mockResolvedValueOnce({
          items: tasks.slice(0, 15).map((task, i) => ({ id: `created_${i}`, ...task })),
        })
        .mockResolvedValueOnce({
          items: tasks.slice(15, 30).map((task, i) => ({ id: `created_${i + 15}`, ...task })),
        })
        .mockResolvedValueOnce({
          items: tasks.slice(30, 35).map((task, i) => ({ id: `created_${i + 30}`, ...task })),
        });

      const result = await factory.createTasksInBatches(tasks, 15);

      expect(result.summary.total).toBe(35);
      expect(result.summary.succeeded).toBe(35);
      expect(result.summary.failed).toBe(0);
      expect(result.created).toHaveLength(35);
      expect(result.failed).toHaveLength(0);
      expect(mockClient.bulkCreate).toHaveBeenCalledTimes(3);
    });

    it('should fail - RED phase: continue processing when one batch fails', async () => {
      const tasks = Array.from({ length: 25 }, (_, i) => ({
        title: `Task ${i + 1}`,
        task12code: `task_${String(i + 1).padStart(3, '0')}`,
      }));

      // First batch succeeds, second batch fails
      vi.mocked(mockClient.bulkCreate)
        .mockResolvedValueOnce({
          items: tasks.slice(0, 15).map((task, i) => ({ id: `created_${i}`, ...task })),
        })
        .mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const result = await factory.createTasksInBatches(tasks, 15);

      expect(result.summary.total).toBe(25);
      expect(result.summary.succeeded).toBe(15);
      expect(result.summary.failed).toBe(10);
      expect(result.created).toHaveLength(15);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        batchNumber: 2,
        taskCount: 10,
        error: 'API rate limit exceeded',
      });
    });

    it('should fail - RED phase: use default batch size of 15', async () => {
      const tasks = Array.from({ length: 20 }, (_, i) => ({
        title: `Task ${i + 1}`,
        task12code: `task_${String(i + 1).padStart(3, '0')}`,
      }));

      vi.mocked(mockClient.bulkCreate)
        .mockResolvedValueOnce({
          items: tasks.slice(0, 15).map((task, i) => ({ id: `created_${i}`, ...task })),
        })
        .mockResolvedValueOnce({
          items: tasks.slice(15, 20).map((task, i) => ({ id: `created_${i + 15}`, ...task })),
        });

      await factory.createTasksInBatches(tasks); // No batchSize parameter

      expect(mockClient.bulkCreate).toHaveBeenCalledTimes(2);
      expect(mockClient.bulkCreate).toHaveBeenCalledWith('68c24591b7d2aad485e8f781', {
        items: tasks.slice(0, 15),
      });
    });

    it('should fail - RED phase: include 300ms delay between batches', async () => {
      const tasks = Array.from({ length: 35 }, (_, i) => ({
        title: `Task ${i + 1}`,
        task12code: `task_${String(i + 1).padStart(3, '0')}`,
      }));

      const startTime = Date.now();
      vi.mocked(mockClient.bulkCreate).mockResolvedValue({ items: [] });

      await factory.createTasksInBatches(tasks, 15);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should have 2 delays (between 3 batches) = 600ms minimum
      // Allow some margin for execution time
      expect(executionTime).toBeGreaterThanOrEqual(550); // 2 * 300ms - margin
    });
  });
});
