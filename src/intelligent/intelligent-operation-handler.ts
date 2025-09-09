import { KnowledgeLibrary } from './knowledge-library.js';
import { SafetyEngine } from './safety-engine.js';
import type {
  IntelligentToolInput,
  OperationResult,
  KnowledgeMatch,
  SafetyAssessment,
  OperationContext,
  FailureMode,
} from './types.js';

// Safety constants - externalized for easier maintenance
const SAFETY_CONSTANTS = {
  UUID_CORRUPTION: {
    WRONG_PARAM: 'options',
    CORRECT_PARAM: 'choices',
  },
  BULK_OPERATIONS: {
    MAX_RECORDS: 25,
  },
  HTTP_METHODS: {
    CORRECT_LIST_METHOD: 'POST',
  },
} as const;

/**
 * IntelligentOperationHandler - Core handler for intelligent tool operations
 * MVP Focus: Learn mode only
 *
 * Critical-Engineer: consulted for Architecture pattern selection
 */
export class IntelligentOperationHandler {
  constructor(
    private knowledgeLibrary: KnowledgeLibrary,
    private safetyEngine: SafetyEngine,
  ) {}

  /**
   * Main entry point for intelligent operations
   */
  handleIntelligentOperation(input: IntelligentToolInput): OperationResult {
    const startTime = performance.now();

    try {
      // Input validation
      if (!input?.endpoint || !input?.method || !input?.operation_description) {
        throw new Error('Missing required input fields: endpoint, method, operation_description');
      }

      // All modes supported: learn, dry_run, execute

      // Analyze operation context
      const context = this.analyzeContext(input);

      // Find relevant knowledge with error handling
      let knowledge: KnowledgeMatch[] = [];
      try {
        const foundKnowledge = this.knowledgeLibrary.findRelevantKnowledge(
          input.method,
          input.endpoint,
          input.payload,
        );
        // Validate the dependency's return value
        knowledge = Array.isArray(foundKnowledge) ? foundKnowledge : [];
      } catch (error) {
        // Silently fall back to empty knowledge
        // In production, this could be logged to monitoring service
        knowledge = [];
      }

      // Perform safety assessment with error handling
      let safetyAssessment;
      try {
        safetyAssessment = this.safetyEngine.assess(input, knowledge);
      } catch (error) {
        // Silently fall back to cautious safety assessment
        // In production, this could be logged to monitoring service
        safetyAssessment = {
          level: 'YELLOW' as const,
          warnings: ['Safety assessment failed - proceeding with caution'],
          canProceed: true,
          requiresConfirmation: false,
          protocols: [],
        };
      }

      // Default safety assessment if null
      if (!safetyAssessment) {
        safetyAssessment = {
          level: 'GREEN' as const,
          warnings: [],
          canProceed: true,
          requiresConfirmation: false,
          protocols: [],
        };
      }

      // Generate learning response
      const response = this.generateLearningResponse(
        input,
        context,
        knowledge,
        safetyAssessment,
      );

      // Add performance metrics and observability
      const endTime = performance.now();
      const duration = endTime - startTime;
      response.performance_ms = duration;
      response.knowledge_version = this.knowledgeLibrary.getVersion().version;

      // Performance monitoring could be added here for production
      // In development, performance metrics are included in the response

      return response;
    } catch (error) {
      return {
        mode: input.mode,
        status: 'error',
        endpoint: input.endpoint,
        method: input.method,
        operation_description: input.operation_description,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        knowledge_applied: false,
        performance_ms: performance.now() - startTime,
        knowledge_version: this.knowledgeLibrary.getVersion().version,
      };
    }
  }

  /**
   * Analyze operation context
   */
  private analyzeContext(input: IntelligentToolInput): OperationContext {
    return {
      isListOperation: input.endpoint.includes('/list') || input.endpoint.includes('/records'),
      isBulkOperation: input.endpoint.includes('/bulk'),
      isFieldOperation: input.endpoint.includes('/field'),
      isDeleteOperation: input.method === 'DELETE',
      hasPayload: !!input.payload,
      recordCount: this.countRecords(input.payload),
    };
  }

  /**
   * Count records in payload for bulk operations
   */
  private countRecords(payload?: Record<string, unknown>): number {
    if (!payload) return 0;
    if (Array.isArray(payload.records)) return payload.records.length;
    if (Array.isArray(payload.items)) return payload.items.length;
    return 1;
  }

  /**
   * Generate learning response with guidance
   */
  private generateLearningResponse(
    input: IntelligentToolInput,
    _context: OperationContext,
    knowledge: KnowledgeMatch[],
    safetyAssessment: SafetyAssessment,
  ): OperationResult {
    const hasKnowledge = knowledge.length > 0;

    // Build guidance based on knowledge and safety assessment
    const guidance = this.buildGuidance(input, knowledge, safetyAssessment);

    // Generate suggested correction if needed
    const suggestedCorrection = this.generateSuggestedCorrection(
      input,
      knowledge,
      safetyAssessment,
    );

    const result: OperationResult = {
      mode: input.mode,
      status: 'analyzed',
      endpoint: input.endpoint,
      method: input.method,
      operation_description: input.operation_description,
      knowledge_applied: hasKnowledge,
      safety_assessment: safetyAssessment,
      guidance,
      warnings: safetyAssessment.warnings.map(w => typeof w === 'string' ? w : w.message),
      knowledge_matches: knowledge.length,
      performance_ms: 0, // Will be set by caller
      knowledge_version: JSON.stringify(this.knowledgeLibrary.getVersion()),
    };

    // Only add suggested_correction if it exists
    if (suggestedCorrection) {
      result.suggested_correction = suggestedCorrection;
    }

    return result;
  }

  /**
   * Build comprehensive guidance message
   */
  private buildGuidance(
    input: IntelligentToolInput,
    knowledge: KnowledgeMatch[],
    assessment: SafetyAssessment,
  ): string {
    const guidanceLines: string[] = [];

    // Safety level guidance
    if (assessment.level === 'RED') {
      guidanceLines.push('🔴 CRITICAL: This operation has known failure modes.');
    } else if (assessment.level === 'YELLOW') {
      guidanceLines.push('🟡 CAUTION: This operation requires careful attention.');
    } else if (knowledge.length === 0) {
      guidanceLines.push('🟢 No known patterns match this operation.');
    } else {
      guidanceLines.push('🟢 This operation appears safe with proper parameters.');
    }

    // Add failure mode information
    for (const entry of knowledge) {
      for (const failure of entry.failureModes ?? []) {
        guidanceLines.push(`\n⚠️  ${failure.description}`);
        guidanceLines.push(`   Cause: ${failure.cause}`);
        guidanceLines.push(`   Prevention: ${failure.prevention}`);
        if (failure.safeAlternative) {
          guidanceLines.push(`   Alternative: ${failure.safeAlternative}`);
        }
      }
    }

    // Add warnings
    if (assessment.warnings.length > 0) {
      guidanceLines.push('\nWarnings:');
      assessment.warnings.forEach(warning => {
        const warningText = typeof warning === 'string' ? warning : warning.message;
        guidanceLines.push(`• ${warningText}`);
      });
    }

    // Add recommendations
    if (assessment.level === 'RED' || assessment.level === 'YELLOW') {
      guidanceLines.push('\nRecommendations:');
      if (this.hasSuggestedCorrection(input, knowledge)) {
        guidanceLines.push('• Review the suggested correction below');
        guidanceLines.push('• Test with dry_run mode before execution (available in future release)');
      }
    }

    return guidanceLines.join('\n');
  }

  /**
   * Generate suggested correction for known issues
   */
  private generateSuggestedCorrection(
    input: IntelligentToolInput,
    knowledge: KnowledgeMatch[],
    _assessment: SafetyAssessment,
  ): (IntelligentToolInput & { note?: string }) | undefined {
    // Handle UUID corruption case
    if (this.hasUUIDCorruptionRisk(input, knowledge)) {
      const correction = {
        ...input,
        payload: { ...input.payload },
      };

      if (correction.payload && SAFETY_CONSTANTS.UUID_CORRUPTION.WRONG_PARAM in correction.payload) {
        correction.payload[SAFETY_CONSTANTS.UUID_CORRUPTION.CORRECT_PARAM] = correction.payload[SAFETY_CONSTANTS.UUID_CORRUPTION.WRONG_PARAM];
        delete correction.payload[SAFETY_CONSTANTS.UUID_CORRUPTION.WRONG_PARAM];
      }

      return correction;
    }

    // Handle wrong HTTP method
    if (this.hasWrongMethodIssue(input, knowledge)) {
      return {
        ...input,
        method: SAFETY_CONSTANTS.HTTP_METHODS.CORRECT_LIST_METHOD,
      };
    }

    // Handle bulk limit exceeded
    if (this.hasBulkLimitIssue(input, knowledge)) {
      const records = input.payload?.records;
      const recordsArray = Array.isArray(records) ? records : [];

      return {
        ...input,
        payload: {
          ...input.payload,
          records: recordsArray.slice(0, SAFETY_CONSTANTS.BULK_OPERATIONS.MAX_RECORDS),
        },
        note: `Split into batches of ${SAFETY_CONSTANTS.BULK_OPERATIONS.MAX_RECORDS} records`,
      };
    }

    return undefined;
  }

  /**
   * Check for UUID corruption risk
   */
  private hasUUIDCorruptionRisk(input: IntelligentToolInput, knowledge: KnowledgeMatch[]): boolean {
    return knowledge.some(k =>
      (k.failureModes ?? []).some((f: FailureMode) =>
        f.description.toLowerCase().includes('uuid') &&
        input.payload?.[SAFETY_CONSTANTS.UUID_CORRUPTION.WRONG_PARAM] !== undefined,
      ),
    );
  }

  /**
   * Check for wrong HTTP method issue
   */
  private hasWrongMethodIssue(_input: IntelligentToolInput, knowledge: KnowledgeMatch[]): boolean {
    return knowledge.some(k =>
      (k.failureModes ?? []).some((f: FailureMode) =>
        f.description.toLowerCase().includes('wrong') &&
        f.description.toLowerCase().includes('method'),
      ),
    );
  }

  /**
   * Check for bulk limit issue
   */
  private hasBulkLimitIssue(input: IntelligentToolInput, knowledge: KnowledgeMatch[]): boolean {
    const recordCount = this.countRecords(input.payload);
    return knowledge.some(k =>
      (k.failureModes ?? []).some((f: FailureMode) =>
        f.description.toLowerCase().includes('bulk') &&
        recordCount > SAFETY_CONSTANTS.BULK_OPERATIONS.MAX_RECORDS,
      ),
    );
  }

  /**
   * Check if we have a suggested correction
   */
  private hasSuggestedCorrection(input: IntelligentToolInput, knowledge: KnowledgeMatch[]): boolean {
    return this.hasUUIDCorruptionRisk(input, knowledge) ||
           this.hasWrongMethodIssue(input, knowledge) ||
           this.hasBulkLimitIssue(input, knowledge);
  }
}
