# Mega-Task Factory Configuration Reference

## Quick Reference Table

| Setting | Current Value | Location | Line | Purpose |
|---------|--------------|----------|------|---------|
| **Batch Size** | 15 tasks | `src/tools/mega-task-factory.ts` | 180 | Number of tasks per API call |
| **Rate Limit Delay** | 300ms | `src/tools/mega-task-factory.ts` | 182 | Delay between batches |
| **Tasks Table ID** | `68c24591b7d2aad485e8f781` | `src/tools/mega-task-factory.ts` | 116, 118, 181 | SmartSuite tasks table |
| **Projects Table ID** | `68a8ff5237fde0bf797c05b3` | `src/tools/mega-task-types.ts` | (in ASSIGNEES) | SmartSuite projects table |

## User/Assignee IDs

| Person | SmartSuite ID | Default Role | Location |
|--------|--------------|--------------|----------|
| Danny Hughes | `66fa7af64b11acf6780c4436` | Default/PM | `mega-task-types.ts` line ~50 |
| Laura Manson | `659beee0402fc49a83b20072` | Scheduling | `mega-task-types.ts` line ~51 |
| Vincent Barnett | `671274d010ce88b13d1c6825` | Video Editor | `mega-task-types.ts` line ~52 |

## Task Durations (Business Days)

| Task Code | Duration | Formula | Location |
|-----------|----------|---------|----------|
| 01_setup | 3 days | Fixed | `backward-scheduler.ts` |
| 02_booking | 10 days | Fixed | `backward-scheduler.ts` |
| 10_filming | Dynamic | `Math.ceil((newVids + amendVids) * 0.15)` | `backward-scheduler.ts` |
| 13_video_edit | 10 days | Fixed | `backward-scheduler.ts` |
| 14_delivery | 1 day | Fixed | `backward-scheduler.ts` |

## How to Change Values

Just ask Claude: "Change the batch size to 20 tasks" or "Update Danny's user ID to xyz123"

## Last Verified
- **Date**: 2025-01-11
- **By**: Holistic Orchestrator
- **Status**: All values current and working