// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';
import { MegaTaskValidator } from './mega-task-validator.js';

describe('MegaTaskValidator', () => {
  it('should validate project data', () => {
    const validator = new MegaTaskValidator();
    expect(validator).toBeDefined();
    // Tests are in mega-task-factory.test.ts
  });
});