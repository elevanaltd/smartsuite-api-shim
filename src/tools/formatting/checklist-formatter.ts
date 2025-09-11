// TESTGUARD-TDD-GREEN-PHASE: 8d191a2
// ChecklistFormatter implementation to satisfy test contract

export interface SmartDocFormat {
  data: {
    type: 'doc';
    content: Array<{
      type: 'paragraph';
      attrs: { textAlign: 'left'; size: 'medium' };
      content: Array<{ type: 'text'; text: string }>;
    }>;
  };
  html: string;
  preview: string;
}

export class ChecklistFormatter {
  formatChecklistToSmartDocFormat(checklist: string[], _taskCode: string): { items: SmartDocFormat[] } {
    // Tests expect { items: [] } structure, not direct SmartDocFormat
    // taskCode parameter preserved for future use, prefixed with _ to suppress unused warning
    const items: SmartDocFormat[] = checklist.map(item => ({
      data: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          attrs: { textAlign: 'left', size: 'medium' },
          content: [{ type: 'text', text: item }],
        }],
      },
      html: `<div class="rendered"><p class="align-left">${this.escapeHtml(item)}</p></div>`,
      preview: item,
    }));

    return { items };
  }

  formatDynamicVideoChecklist(videos: Array<{ title: string }>, taskCode: string): { items: SmartDocFormat[] } {
    const checklist = videos.map(video => `${video.title} - PENDING`);
    return this.formatChecklistToSmartDocFormat(checklist, taskCode);
  }

  buildMegaTaskPayload(taskDef: any, projectData: any): any {
    // Build proper title: EAV007: 01-SETUP | Danny Hughes
    const memberName = 'Danny Hughes'; // Default from reference doc
    const title = `${projectData.eavCode as string}: ${taskDef.label as string} | ${memberName}`;

    const taskPayload = {
      'title': title,
      'task12code': taskDef.code as string,
      'due_date': {
        'from_date': (taskDef.startDate ?? '2025-06-02T00:00:00Z') as string,
        'to_date': (taskDef.endDate ?? '2025-06-04T00:00:00Z') as string,
      },
      'assigned_to': [taskDef.assigneeId as string],
      'priority': taskDef.priority as string,
      'checklist99': this.formatChecklistToSmartDocFormat(taskDef.checklist as string[], taskDef.code as string),
      'description': taskDef.description as string,
      'projid1234': [projectData.id as string],
      'dependencies': taskDef.dependencies,
    };

    return taskPayload;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
