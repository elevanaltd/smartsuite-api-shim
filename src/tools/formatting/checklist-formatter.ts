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
  formatChecklistToSmartDocFormat(checklist: string[], taskCode: string): SmartDocFormat {
    const content = checklist.map(item => ({
      type: "paragraph" as const,
      attrs: { textAlign: "left" as const, size: "medium" as const },
      content: [{ type: "text" as const, text: item }]
    }));
    
    const html = `<div class="rendered">${checklist.map(item => 
      `<p class="align-left">${this.escapeHtml(item)}</p>`
    ).join('')}</div>`;
    
    const preview = checklist.join('; ');
    
    return {
      data: {
        type: "doc",
        content
      },
      html,
      preview
    };
  }
  
  formatDynamicVideoChecklist(videos: Array<{ title: string }>, taskCode: string): SmartDocFormat {
    const checklist = videos.map(video => `${video.title} - PENDING`);
    return this.formatChecklistToSmartDocFormat(checklist, taskCode);
  }
  
  buildMegaTaskPayload(task: any, project: any): any {
    const taskPayload = {
      "title": task.title,
      "task12code": task.code,
      "taskdue456": {
        "to_date": task.endDate
      },
      "assigned_to": [task.assigneeId],
      "priority": task.priority,
      "task_checklist": task.checklist,
      "description": task.description,
      "project_connection": [project.id],
      "dependencies": task.dependencies
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
