// Integration test for FieldTranslator with real SmartSuite data
import { FieldTranslator } from '../../src/lib/field-translator';
// Context7: consulted for path
import * as path from 'path';
// Context7: consulted for fs-extra
import * as fs from 'fs-extra';

describe('FieldTranslator Integration Tests', () => {
  let translator: FieldTranslator;
  const projectsTableId = '68a8ff5237fde0bf797c05b3';
  const mappingsDir = '/Volumes/EAV/new-system/data/field-mappings/';

  beforeEach(async () => {
    translator = new FieldTranslator();
    
    // Only load if directory exists
    if (await fs.pathExists(mappingsDir)) {
      await translator.loadAllMappings(mappingsDir);
    } else {
      // Fallback: load from mock data if real mappings not available
      const mockMapping = {
        tableName: 'projects',
        tableId: projectsTableId,
        solutionId: '68b6d66b33630eb365ae54cb',
        fields: {
          title: 'title',
          eavCode: 'autonumber',
          projectName: 'project_name_actual',
          client: 'sbfc98645c',
          projectManager: 'project_manager',
          primaryContactEmail: 'primary_contact',
          projectPhase: 'status',
          priority: 'priority',
          totalVideosCount: 'total_videos_count',
          initialProjectCost: 'initial_cost',
          agreementDate: 'agreement_date',
          bookingStreamStatus: 'bkgstream',
          filmingBlockers: 'se202948fd',
          videosOld: 'si8yx4fb',
          firstCreated: 'first_created',
          lastUpdated: 'last_updated'
        }
      };
      
      translator['mappings'].set(projectsTableId, mockMapping);
    }
  });

  describe('Real SmartSuite Data Translation', () => {
    it('should translate human-readable project data to API format', () => {
      const humanProjectData = {
        projectName: 'Website Redesign Project',
        projectPhase: 'PRE-PRODUCTION',
        priority: 'High',
        initialProjectCost: 25000,
        totalVideosCount: 5,
        agreementDate: '2024-01-15',
        client: 'client123',
        projectManager: 'pm@example.com'
      };

      const apiData = translator.humanToApi(projectsTableId, humanProjectData);

      expect(apiData).toEqual({
        project_name_actual: 'Website Redesign Project',
        status: 'PRE-PRODUCTION',
        priority: 'High',
        initial_cost: 25000,
        total_videos_count: 5,
        agreement_date: '2024-01-15',
        sbfc98645c: 'client123', // Cryptic client field
        project_manager: 'pm@example.com'
      });
    });

    it('should translate API data back to human-readable format', () => {
      const apiProjectData = {
        title: 'Auto Generated Title',
        autonumber: 'EAV001',
        project_name_actual: 'Mobile App Development',
        status: 'PRODUCTION',
        priority: 'Urgent',
        initial_cost: 50000,
        total_videos_count: 8,
        agreement_date: '2024-02-01',
        sbfc98645c: 'client456',
        project_manager: 'lead@example.com',
        bkgstream: 'FILMING BOOKED',
        se202948fd: 2, // Filming blockers count
        first_created: '2024-01-01T10:00:00Z',
        last_updated: '2024-01-15T14:30:00Z'
      };

      const humanData = translator.apiToHuman(projectsTableId, apiProjectData);

      expect(humanData).toEqual({
        title: 'Auto Generated Title',
        eavCode: 'EAV001',
        projectName: 'Mobile App Development',
        projectPhase: 'PRODUCTION',
        priority: 'Urgent',
        initialProjectCost: 50000,
        totalVideosCount: 8,
        agreementDate: '2024-02-01',
        client: 'client456',
        projectManager: 'lead@example.com',
        bookingStreamStatus: 'FILMING BOOKED',
        filmingBlockers: 2,
        firstCreated: '2024-01-01T10:00:00Z',
        lastUpdated: '2024-01-15T14:30:00Z'
      });
    });

    it('should preserve unmapped fields during translation', () => {
      const mixedData = {
        projectName: 'Test Project',
        customField: 'custom value',
        unmappedApiField: 'api value',
        priority: 'Normal'
      };

      const apiData = translator.humanToApi(projectsTableId, mixedData);
      
      expect(apiData).toEqual({
        project_name_actual: 'Test Project',
        customField: 'custom value', // Preserved
        unmappedApiField: 'api value', // Preserved
        priority: 'Normal'
      });
    });

    it('should correctly detect field types in real SmartSuite data', () => {
      const humanFields = {
        projectName: 'Test',
        priority: 'High',
        totalVideosCount: 5
      };

      const apiFields = {
        project_name_actual: 'Test',
        priority: 'High',
        total_videos_count: 5
      };

      const crypticFields = {
        sbfc98645c: 'client123',
        se202948fd: 2,
        si8yx4fb: 'video_link',
        solamlxu: 'new_video_link'
      };

      expect(translator.detectFieldType(humanFields)).toBe('human');
      expect(translator.detectFieldType(apiFields)).toBe('api');
      expect(translator.detectFieldType(crypticFields)).toBe('cryptic');
    });

    it('should handle complex nested data structures', () => {
      const complexData = {
        projectName: 'Complex Project',
        clientContacts: {
          richText: '<p>Contact details</p>',
          mentions: ['user1', 'user2']
        },
        projectBrief: {
          content: 'Project description',
          attachments: ['file1.pdf', 'file2.doc']
        },
        financialRecords: ['record1', 'record2'],
        projectLifecycle: {
          start: '2024-01-01',
          end: '2024-06-01'
        }
      };

      const apiData = translator.humanToApi(projectsTableId, complexData);
      const backToHuman = translator.apiToHuman(projectsTableId, apiData);

      // Complex structures should be preserved
      expect(apiData.project_name_actual).toBe('Complex Project');
      expect(apiData.client_contacts).toEqual(complexData.clientContacts);
      expect(backToHuman.projectName).toBe('Complex Project');
      expect(backToHuman.clientContacts).toEqual(complexData.clientContacts);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should gracefully handle missing table mappings', () => {
      const unknownTableId = 'unknown123';
      const testData = { name: 'test' };

      const result = translator.humanToApi(unknownTableId, testData);
      expect(result).toEqual(testData); // Should pass through unchanged
    });

    it('should handle empty or null data gracefully', () => {
      expect(translator.humanToApi(projectsTableId, {})).toEqual({});
      expect(translator.apiToHuman(projectsTableId, {})).toEqual({});
      expect(translator.detectFieldType({})).toBe('unknown');
    });

    it('should handle malformed field mappings', () => {
      // This should not crash the translator
      const badData = null as any;
      expect(translator.detectFieldType(badData)).toBe('unknown');
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle large record sets efficiently', () => {
      const largeDataset: Record<string, any> = {};
      
      // Create 1000 fields to test performance
      for (let i = 0; i < 1000; i++) {
        largeDataset[`field${i}`] = `value${i}`;
      }
      
      // Add some known mappable fields
      largeDataset.projectName = 'Performance Test';
      largeDataset.priority = 'High';

      const startTime = Date.now();
      const result = translator.humanToApi(projectsTableId, largeDataset);
      const endTime = Date.now();

      // Should complete in reasonable time (< 100ms for 1000 fields)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Known mappings should be translated
      expect(result.project_name_actual).toBe('Performance Test');
      expect(result.priority).toBe('High');
      
      // Unknown fields should pass through
      expect(result.field0).toBe('value0');
    });
  });
});