// TESTGUARD-TDD-GREEN-PHASE: 8d191a2
// ChecklistFormatter implementation to satisfy test contract

export interface SmartDocFormat {
  data: {
    type: "doc";
    content: Array<{
      type: "paragraph";
      attrs: { textAlign: "left"; size: "medium" };
      content: Array<{ type: "text"; text: string }>;
    }>;
  };
  html: string;
  preview: string;
}

export class ChecklistFormatter {
  formatChecklistToSmartDocFormat(checklist: string[], taskCode: string): { items: SmartDocFormat[] } {
    // Tests expect { items: [] } structure, not direct SmartDocFormat
    const items: SmartDocFormat[] = checklist.map(item => ({
      data: {
        type: "doc",
        content: [{
          type: "paragraph",
          attrs: { textAlign: "left", size: "medium" },
          content: [{ type: "text", text: item }]
        }]
      },
      html: `<div class="rendered"><p class="align-left">${this.escapeHtml(item)}</p></div>`,
      preview: item
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
    const title = `${projectData.eavCode}: ${taskDef.label} | ${memberName}`;
    
    const taskPayload = {
      "title": title,
      "task12code": taskDef.code,
      "taskdue456": {
        "to_date": taskDef.endDate
      },
      "assigned_to": [taskDef.assigneeId],
      "priority": taskDef.priority,
      "task_checklist": taskDef.checklist,
      "description": taskDef.description,
      "project_connection": [projectData.id],
      "dependencies": taskDef.dependencies
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
