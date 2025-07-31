/**
 * Comprehensive test suite for data protection framework
 */

const DataProtectionService = require('../services/dataProtection');
const CalendarSanitizer = require('../services/calendarSanitizer');
const ConferenceProtection = require('../services/conferenceProtection');
const AnonymizationManager = require('../utils/anonymization');

describe('Data Protection Framework', () => {
  let dataProtection;
  let calendarSanitizer;
  let conferenceProtection;
  let anonymizer;

  beforeEach(() => {
    dataProtection = new DataProtectionService({ enableLogging: false });
    calendarSanitizer = new CalendarSanitizer();
    conferenceProtection = new ConferenceProtection();
    anonymizer = new AnonymizationManager();
  });

  afterEach(() => {
    dataProtection.reset();
    calendarSanitizer.reset();
    anonymizer.reset();
  });

  describe('ConferenceProtection', () => {
    describe('Zoom data removal', () => {
      test('should remove Zoom URLs', () => {
        const testEvent = {
          summary: 'Team Meeting',
          description: 'Join Zoom: https://zoom.us/j/1234567890?pwd=abcdef',
          location: 'https://company.zoom.us/j/1234567890'
        };

        const sanitized = conferenceProtection.sanitizeEvent(testEvent);
        
        expect(sanitized.description).not.toContain('zoom.us');
        expect(sanitized.description).toContain('[MEETING_INFO_REMOVED]');
        expect(sanitized.location).not.toContain('zoom.us');
      });

      test('should remove meeting IDs and passcodes', () => {
        const testEvent = {
          description: `
            Meeting ID: 123 456 7890
            Passcode: secretpass123
            Dial: +1 123-456-7890
          `
        };

        const sanitized = conferenceProtection.sanitizeEvent(testEvent);
        
        expect(sanitized.description).not.toContain('123 456 7890');
        expect(sanitized.description).not.toContain('secretpass123');
        expect(sanitized.description).toContain('[MEETING_INFO_REMOVED]');
      });

      test('should handle complex Zoom meeting details', () => {
        const testEvent = {
          description: `
            Join Zoom Meeting
            https://company.zoom.us/j/87654321098?pwd=VGhpcyBpcyBhIHRlc3Q
            
            Meeting ID: 876 5432 1098
            Passcode: testpass
            
            One tap mobile
            +15551234567,,87654321098#,,,,*testpass#
            
            Dial by your location
                +1 555 123 4567 US (New York)
                +1 555 987 6543 US (Chicago)
            
            Meeting ID: 876 5432 1098
            Find your local number: https://zoom.us/u/localnum
          `
        };

        const sanitized = conferenceProtection.sanitizeEvent(testEvent);
        
        expect(sanitized.description).not.toContain('zoom.us');
        expect(sanitized.description).not.toContain('876 5432 1098');
        expect(sanitized.description).not.toContain('testpass');
        expect(sanitized.description).not.toContain('+15551234567');
        expect(sanitized.description).toContain('[MEETING_INFO_REMOVED]');
      });
    });

    describe('Teams data removal', () => {
      test('should remove Teams URLs', () => {
        const testEvent = {
          description: 'Microsoft Teams meeting: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123',
          location: 'https://teams.live.com/meet/johndoe'
        };

        const sanitized = conferenceProtection.sanitizeEvent(testEvent);
        
        expect(sanitized.description).not.toContain('teams.microsoft.com');
        expect(sanitized.description).toContain('[MEETING_INFO_REMOVED]');
        expect(sanitized.location).not.toContain('teams.live.com');
      });
    });

    describe('Google Meet data removal', () => {
      test('should remove Meet URLs', () => {
        const testEvent = {
          description: 'Google Meet: https://meet.google.com/abc-defg-hij',
          hangoutLink: 'https://meet.google.com/abc-defg-hij'
        };

        const sanitized = conferenceProtection.sanitizeEvent(testEvent);
        
        expect(sanitized.description).not.toContain('meet.google.com');
        expect(sanitized.hangoutLink).toBeUndefined();
      });
    });

    describe('Conference data object removal', () => {
      test('should sanitize conferenceData object', () => {
        const testEvent = {
          conferenceData: {
            conferenceId: 'abc-defg-hij',
            conferenceSolution: {
              name: 'Google Meet'
            },
            entryPoints: [
              {
                entryPointType: 'video',
                uri: 'https://meet.google.com/abc-defg-hij'
              }
            ]
          }
        };

        const sanitized = conferenceProtection.sanitizeEvent(testEvent);
        
        expect(sanitized.conferenceData.entryPoints).toBeUndefined();
        expect(sanitized.conferenceData.conferenceType).toBe('VIRTUAL_MEETING');
      });
    });

    describe('Validation', () => {
      test('should validate clean sanitization', () => {
        const cleanEvent = {
          summary: 'Team Meeting',
          description: 'Discuss project status',
          location: 'Conference Room A'
        };

        const validation = conferenceProtection.validateSanitization(cleanEvent);
        expect(validation.isClean).toBe(true);
        expect(validation.issues).toHaveLength(0);
      });

      test('should detect remaining conference data', () => {
        const dirtyEvent = {
          summary: 'Meeting',
          description: 'Join at zoom.us/j/123456',
          hangoutLink: 'https://meet.google.com/test'
        };

        const validation = conferenceProtection.validateSanitization(dirtyEvent);
        expect(validation.isClean).toBe(false);
        expect(validation.issues.length).toBeGreaterThan(0);
      });
    });
  });

  describe('AnonymizationManager', () => {
    describe('Person anonymization', () => {
      test('should consistently anonymize the same person', () => {
        const person1 = anonymizer.getAnonymizedPerson('john.doe@company.com');
        const person2 = anonymizer.getAnonymizedPerson('john.doe@company.com');
        
        expect(person1).toBe(person2);
        expect(person1).toMatch(/^PERSON_\d+$/);
      });

      test('should anonymize different people differently', () => {
        const person1 = anonymizer.getAnonymizedPerson('john.doe@company.com');
        const person2 = anonymizer.getAnonymizedPerson('jane.smith@company.com');
        
        expect(person1).not.toBe(person2);
      });
    });

    describe('Organization anonymization', () => {
      test('should classify client domains', () => {
        // Note: This would need actual client domains configured
        const org = anonymizer.getAnonymizedOrganization('example.com');
        expect(org).toMatch(/^(CLIENT_FIRM|EXTERNAL_ORG)_\d+$/);
      });

      test('should handle vendor domains', () => {
        const org = anonymizer.getAnonymizedOrganization('zoom.us');
        expect(org).toMatch(/^VENDOR_\d+$/);
      });
    });

    describe('Location anonymization', () => {
      test('should classify virtual meetings', () => {
        const location1 = anonymizer.getAnonymizedLocation('Zoom Room');
        const location2 = anonymizer.getAnonymizedLocation('Microsoft Teams');
        
        expect(location1).toMatch(/^VIRTUAL_MEETING_\d+$/);
        expect(location2).toMatch(/^VIRTUAL_MEETING_\d+$/);
      });

      test('should classify conference rooms', () => {
        const location = anonymizer.getAnonymizedLocation('Conference Room A');
        expect(location).toMatch(/^CONFERENCE_ROOM_\d+$/);
      });

      test('should classify office locations', () => {
        const location = anonymizer.getAnonymizedLocation('Main Office Building');
        expect(location).toMatch(/^OFFICE_LOCATION_\d+$/);
      });
    });

    describe('Reverse mapping', () => {
      test('should map anonymized data back to original', () => {
        const originalEmail = 'test@company.com';
        const anonymized = anonymizer.getAnonymizedPerson(originalEmail);
        const mapped = anonymizer.mapBackToOriginal(anonymized);
        
        expect(mapped).toBe(originalEmail);
      });

      test('should handle complex nested data', () => {
        const originalData = {
          attendees: ['john@company.com', 'jane@client.com'],
          location: 'Conference Room A'
        };

        const anonymizedData = {
          attendees: [
            anonymizer.getAnonymizedPerson('john@company.com'),
            anonymizer.getAnonymizedPerson('jane@client.com')
          ],
          location: anonymizer.getAnonymizedLocation('Conference Room A')
        };

        const mapped = anonymizer.mapBackToOriginal(anonymizedData);
        
        expect(mapped.attendees).toContain('john@company.com');
        expect(mapped.attendees).toContain('jane@client.com');
        expect(mapped.location).toBe('Conference Room A');
      });
    });
  });

  describe('CalendarSanitizer', () => {
    describe('Event sanitization', () => {
      test('should sanitize complete calendar event', () => {
        const testEvent = {
          id: 'real_event_id_123',
          summary: 'Project ABC-1234 Review Meeting',
          description: 'Confidential discussion about budget allocation. Join: https://zoom.us/j/123456',
          location: 'Conference Room 1, 123 Main St',
          creator: {
            email: 'john.doe@company.com',
            displayName: 'John Doe'
          },
          attendees: [
            {
              email: 'jane.smith@client.com',
              displayName: 'Jane Smith',
              responseStatus: 'accepted'
            }
          ],
          start: { dateTime: '2024-01-01T10:00:00Z' },
          end: { dateTime: '2024-01-01T11:00:00Z' }
        };

        const sanitized = calendarSanitizer.sanitizeEvent(testEvent);
        
        // Check ID anonymization
        expect(sanitized.id).not.toBe(testEvent.id);
        expect(sanitized.id).toMatch(/^anon_/);
        
        // Check sensitive content removal
        expect(sanitized.summary).not.toContain('ABC-1234');
        expect(sanitized.description).not.toContain('Confidential');
        expect(sanitized.description).not.toContain('budget');
        expect(sanitized.description).not.toContain('zoom.us');
        
        // Check attendee anonymization
        expect(sanitized.attendees[0].email).not.toContain('jane.smith');
        expect(sanitized.attendees[0].email).toMatch(/PERSON_\d+@/);
        
        // Check creator anonymization
        expect(sanitized.creator.email).not.toContain('john.doe');
        expect(sanitized.creator.email).toMatch(/PERSON_\d+@/);
        
        // Check that timing is preserved
        expect(sanitized.start).toEqual(testEvent.start);
        expect(sanitized.end).toEqual(testEvent.end);
      });

      test('should preserve semantic meaning while anonymizing', () => {
        const testEvent = {
          summary: 'Daily Standup Meeting',
          description: 'Team sync for Project Phoenix',
          attendees: [
            { email: 'dev1@company.com', responseStatus: 'accepted' },
            { email: 'dev2@company.com', responseStatus: 'tentative' },
            { email: 'pm@company.com', responseStatus: 'accepted' }
          ]
        };

        const sanitized = calendarSanitizer.sanitizeEvent(testEvent);
        
        // Should preserve meeting type concept
        expect(sanitized.summary.toLowerCase()).toContain('standup');
        
        // Should preserve team structure
        expect(sanitized.attendees).toHaveLength(3);
        expect(sanitized.attendees[0].responseStatus).toBe('accepted');
        expect(sanitized.attendees[1].responseStatus).toBe('tentative');
      });
    });

    describe('Minimal safe data creation', () => {
      test('should create minimal safe data for OpenAI', () => {
        const testEvents = [
          {
            summary: 'Project Review with ABC Corp',
            description: 'Confidential budget discussion. Zoom: https://zoom.us/j/123',
            location: '123 Corporate Blvd, Suite 400',
            attendees: [
              { email: 'contact@abccorp.com', responseStatus: 'accepted' }
            ],
            start: { dateTime: '2024-01-01T10:00:00Z' },
            end: { dateTime: '2024-01-01T11:00:00Z' },
            recurrence: ['FREQ=WEEKLY'],
            conferenceData: {
              entryPoints: [{ uri: 'https://zoom.us/j/123' }]
            }
          }
        ];

        const safeData = calendarSanitizer.createMinimalSafeData(testEvents);
        
        expect(safeData).toHaveLength(1);
        
        const safeEvent = safeData[0];
        
        // Check required fields are present
        expect(safeEvent.start).toBeDefined();
        expect(safeEvent.end).toBeDefined();
        expect(safeEvent.summary).toBeDefined();
        
        // Check sensitive data is removed
        expect(safeEvent.summary).not.toContain('ABC Corp');
        expect(safeEvent.description).not.toContain('Confidential');
        expect(safeEvent.description).not.toContain('zoom.us');
        
        // Check metadata is added
        expect(safeEvent.metadata).toBeDefined();
        expect(safeEvent.metadata.hasAttendees).toBe(true);
        expect(safeEvent.metadata.isRecurring).toBe(true);
        expect(safeEvent.metadata.duration).toBe(60);
        expect(safeEvent.metadata.attendeeCount).toBe(1);
      });
    });

    describe('Safety validation', () => {
      test('should detect unsafe data', () => {
        const unsafeData = [
          {
            summary: 'Meeting with john.doe@company.com',
            description: 'Call +1-555-123-4567 for details',
            location: 'https://zoom.us/j/123456'
          }
        ];

        const validation = calendarSanitizer.validateSafety(unsafeData);
        
        expect(validation.isSafe).toBe(false);
        expect(validation.issues.length).toBeGreaterThan(0);
      });

      test('should pass safe data validation', () => {
        const safeData = [
          {
            summary: 'Meeting with PERSON_1',
            description: 'Discussion about PROJECT_1',
            location: 'CONFERENCE_ROOM_1',
            attendees: [
              { email: 'PERSON_2@CLIENT_FIRM_1' }
            ]
          }
        ];

        const validation = calendarSanitizer.validateSafety(safeData);
        
        expect(validation.isSafe).toBe(true);
        expect(validation.issues).toHaveLength(0);
      });
    });
  });

  describe('DataProtectionService Integration', () => {
    describe('Protection levels', () => {
      test('should apply minimal protection', async () => {
        const testData = [
          {
            summary: 'Team Meeting',
            description: 'Join Zoom: https://zoom.us/j/123',
            attendees: [{ email: 'john@company.com' }]
          }
        ];

        const result = await dataProtection.processCalendarData(testData, 'MINIMAL');
        
        expect(result.safeData[0].description).not.toContain('zoom.us');
        // Minimal protection keeps attendee emails
        expect(result.safeData[0].attendees[0].email).toBe('john@company.com');
      });

      test('should apply standard protection', async () => {
        const testData = [
          {
            summary: 'Project ABC-123 Review',
            description: 'Confidential discussion. Zoom: https://zoom.us/j/123',
            attendees: [{ email: 'john@company.com' }],
            start: { dateTime: '2024-01-01T10:00:00Z' },
            end: { dateTime: '2024-01-01T11:00:00Z' }
          }
        ];

        const result = await dataProtection.processCalendarData(testData, 'STANDARD');
        
        expect(result.safeData[0].summary).not.toContain('ABC-123');
        expect(result.safeData[0].description).not.toContain('Confidential');
        expect(result.safeData[0].description).not.toContain('zoom.us');
        expect(result.safeData[0].attendees[0].email).toMatch(/PERSON_\d+@/);
        expect(result.safeData[0].metadata).toBeDefined();
      });

      test('should apply maximum protection', async () => {
        const testData = [
          {
            summary: 'Daily Standup Meeting',
            description: 'Team sync discussion',
            attendees: [{ email: 'john@company.com' }],
            location: 'Conference Room A',
            start: { dateTime: '2024-01-01T10:00:00Z' },
            end: { dateTime: '2024-01-01T11:00:00Z' }
          }
        ];

        const result = await dataProtection.processCalendarData(testData, 'MAXIMUM');
        
        // Maximum protection should be very aggressive
        expect(result.safeData[0].summary).toBe('MEETING_TYPE_C'); // standup -> MEETING_TYPE_C
        expect(result.safeData[0].description).toBeUndefined();
        expect(result.safeData[0].location).toBeUndefined();
        expect(result.safeData[0].attendees).toBeUndefined();
        
        // Should keep essential metadata
        expect(result.safeData[0].metadata.hasAttendees).toBe(true);
        expect(result.safeData[0].metadata.duration).toBe(60);
      });
    });

    describe('Error handling', () => {
      test('should handle invalid input data', async () => {
        await expect(
          dataProtection.processCalendarData(null)
        ).rejects.toThrow('Invalid calendar data format');
      });

      test('should handle unknown protection level', async () => {
        const testData = [{ summary: 'Test' }];
        
        await expect(
          dataProtection.processCalendarData(testData, 'UNKNOWN')
        ).rejects.toThrow('Unknown protection level');
      });

      test('should handle strict mode validation failures', async () => {
        const strictProtection = new DataProtectionService({ 
          strictMode: true,
          enableLogging: false 
        });
        
        const testData = [
          {
            summary: 'Meeting with real.email@company.com',
            description: 'Call +1-555-123-4567'
          }
        ];

        // Mock the validation to fail
        jest.spyOn(strictProtection, 'validateDataSafety').mockReturnValue({
          isSafe: false,
          issues: ['Unsafe data detected']
        });

        await expect(
          strictProtection.processCalendarData(testData, 'STANDARD')
        ).rejects.toThrow('Data safety validation failed');
      });
    });

    describe('Statistics and monitoring', () => {
      test('should track processing statistics', async () => {
        const testData = [
          {
            summary: 'Meeting 1',
            attendees: [{ email: 'john@company.com' }, { email: 'jane@client.com' }],
            conferenceData: { entryPoints: [{ uri: 'https://zoom.us/j/123' }] }
          },
          {
            summary: 'Meeting 2',
            attendees: [{ email: 'bob@vendor.com' }]
          }
        ];

        const result = await dataProtection.processCalendarData(testData, 'STANDARD');
        
        expect(result.stats.eventsProcessed).toBe(2);
        expect(result.stats.attendeesAnonymized).toBe(3);
        expect(result.stats.conferenceDataRemoved).toBe(1);
        expect(result.stats.lastProcessed).toBeDefined();
      });

      test('should provide protection statistics', () => {
        const stats = dataProtection.getProtectionStats();
        
        expect(stats).toHaveProperty('eventsProcessed');
        expect(stats).toHaveProperty('sensitiveDataRemoved');
        expect(stats).toHaveProperty('conferenceDataRemoved');
        expect(stats).toHaveProperty('attendeesAnonymized');
        expect(stats).toHaveProperty('sanitizerStats');
        expect(stats).toHaveProperty('options');
      });
    });

    describe('Configuration', () => {
      test('should support configuration updates', () => {
        dataProtection.configure({
          strictMode: true,
          enableLogging: true
        });

        const stats = dataProtection.getProtectionStats();
        expect(stats.options.strictMode).toBe(true);
        expect(stats.options.enableLogging).toBe(true);
      });

      test('should create production instance with correct settings', () => {
        const prodInstance = DataProtectionService.createProductionInstance();
        const stats = prodInstance.getProtectionStats();
        
        expect(stats.options.strictMode).toBe(true);
        expect(stats.options.enableLogging).toBe(false);
      });

      test('should create development instance with correct settings', () => {
        const devInstance = DataProtectionService.createDevelopmentInstance();
        const stats = devInstance.getProtectionStats();
        
        expect(stats.options.strictMode).toBe(false);
        expect(stats.options.enableLogging).toBe(true);
      });
    });
  });

  describe('Real-world scenarios', () => {
    test('should handle complex real calendar event', async () => {
      const realEvent = {
        kind: 'calendar#event',
        etag: '"1234567890"',
        id: 'abc123def456',
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event?eid=abc123',
        created: '2024-01-01T08:00:00.000Z',
        updated: '2024-01-01T08:30:00.000Z',
        summary: 'Q1 Budget Review - Project Phoenix (Confidential)',
        description: `
          Quarterly budget review for Project Phoenix
          
          CONFIDENTIAL - Internal discussion only
          
          Agenda:
          - Revenue projections 
          - Cost analysis for ABC-1234 initiative
          - Resource allocation for Q2
          
          Join Zoom Meeting:
          https://company.zoom.us/j/87654321098?pwd=VGhpcyBpcyBhIHRlc3Q
          
          Meeting ID: 876 5432 1098
          Passcode: phoenix2024
          
          Dial-in: +1-555-123-4567
          Access Code: 876543
        `,
        location: 'Executive Conference Room, Floor 15, 123 Corporate Plaza',
        creator: {
          email: 'cfo@company.com',
          displayName: 'Chief Financial Officer',
          self: false
        },
        organizer: {
          email: 'cfo@company.com',
          displayName: 'Chief Financial Officer'
        },
        start: {
          dateTime: '2024-01-15T14:00:00-08:00',
          timeZone: 'America/Los_Angeles'
        },
        end: {
          dateTime: '2024-01-15T15:30:00-08:00',
          timeZone: 'America/Los_Angeles'
        },
        attendees: [
          {
            email: 'ceo@company.com',
            displayName: 'Chief Executive Officer',
            responseStatus: 'accepted'
          },
          {
            email: 'vp.engineering@company.com',
            displayName: 'VP Engineering',
            responseStatus: 'tentative'
          },
          {
            email: 'external.consultant@bigcorp.com',
            displayName: 'External Consultant',
            responseStatus: 'needsAction'
          }
        ],
        conferenceData: {
          conferenceId: 'phoenix-q1-review',
          conferenceSolution: {
            name: 'Zoom Meeting'
          },
          entryPoints: [
            {
              entryPointType: 'video',
              uri: 'https://company.zoom.us/j/87654321098?pwd=VGhpcyBpcyBhIHRlc3Q'
            },
            {
              entryPointType: 'phone',
              uri: 'tel:+1-555-123-4567',
              accessCode: '876543'
            }
          ]
        },
        extendedProperties: {
          private: {
            'internal-project-code': 'PHX-Q1-2024',
            'budget-category': 'executive-review'
          }
        }
      };

      const result = await dataProtection.processCalendarData([realEvent], 'STANDARD');
      const sanitized = result.safeData[0];
      
      // Verify all sensitive data is removed
      expect(sanitized.summary).not.toContain('Phoenix');
      expect(sanitized.summary).not.toContain('Confidential');
      expect(sanitized.description).not.toContain('CONFIDENTIAL');
      expect(sanitized.description).not.toContain('ABC-1234');
      expect(sanitized.description).not.toContain('zoom.us');
      expect(sanitized.description).not.toContain('phoenix2024');
      expect(sanitized.description).not.toContain('+1-555-123-4567');
      
      // Verify attendees are anonymized
      expect(sanitized.attendees.every(a => a.email.includes('PERSON_'))).toBe(true);
      expect(sanitized.attendees.every(a => a.email.includes('@'))).toBe(true);
      
      // Verify creator/organizer anonymized
      expect(sanitized.creator.email).toMatch(/PERSON_\d+@/);
      expect(sanitized.organizer.email).toMatch(/PERSON_\d+@/);
      
      // Verify location anonymized
      expect(sanitized.location).toMatch(/^(CONFERENCE_ROOM|OFFICE_LOCATION)_\d+$/);
      
      // Verify timing preserved
      expect(sanitized.start).toEqual(realEvent.start);
      expect(sanitized.end).toEqual(realEvent.end);
      
      // Verify metadata is useful
      expect(sanitized.metadata.hasAttendees).toBe(true);
      expect(sanitized.metadata.attendeeCount).toBe(3);
      expect(sanitized.metadata.duration).toBe(90);
      
      // Verify no conference data remains
      expect(sanitized.conferenceData?.entryPoints).toBeUndefined();
      
      // Verify extended properties cleaned
      expect(sanitized.extendedProperties?.private).toEqual({});
      
      // Final safety check
      const safetyCheck = dataProtection.validateDataSafety([sanitized]);
      expect(safetyCheck.isSafe).toBe(true);
    });

    test('should handle batch processing of multiple events', async () => {
      const events = Array.from({ length: 50 }, (_, i) => ({
        id: `event_${i}`,
        summary: `Meeting ${i} - Project ABC-${i.toString().padStart(3, '0')}`,
        description: `Confidential discussion about topic ${i}. Zoom: https://zoom.us/j/12345678${i}`,
        attendees: [
          { email: `user${i}@company.com`, responseStatus: 'accepted' },
          { email: `external${i}@client.com`, responseStatus: 'tentative' }
        ],
        start: { dateTime: `2024-01-${(i % 28) + 1}T10:00:00Z` },
        end: { dateTime: `2024-01-${(i % 28) + 1}T11:00:00Z` }
      }));

      const result = await dataProtection.processCalendarData(events, 'STANDARD');
      
      expect(result.safeData).toHaveLength(50);
      expect(result.stats.eventsProcessed).toBe(50);
      expect(result.stats.attendeesAnonymized).toBe(100);
      
      // Verify each event is properly sanitized
      result.safeData.forEach((event, i) => {
        expect(event.summary).not.toContain(`ABC-${i.toString().padStart(3, '0')}`);
        expect(event.description).not.toContain('Confidential');
        expect(event.description).not.toContain('zoom.us');
        expect(event.attendees[0].email).toMatch(/PERSON_\d+@/);
      });
      
      // Final safety validation
      const safetyCheck = dataProtection.validateDataSafety(result.safeData);
      expect(safetyCheck.isSafe).toBe(true);
    });
  });

  describe('Edge cases and robustness', () => {
    test('should handle events with minimal data', async () => {
      const minimalEvent = {
        summary: 'Meeting',
        start: { dateTime: '2024-01-01T10:00:00Z' },
        end: { dateTime: '2024-01-01T11:00:00Z' }
      };

      const result = await dataProtection.processCalendarData([minimalEvent], 'STANDARD');
      
      expect(result.safeData).toHaveLength(1);
      expect(result.safeData[0].summary).toBe('Meeting');
      expect(result.safeData[0].metadata.hasAttendees).toBe(false);
    });

    test('should handle events with null/undefined fields', async () => {
      const event = {
        summary: null,
        description: undefined,
        attendees: null,
        location: '',
        start: { dateTime: '2024-01-01T10:00:00Z' },
        end: { dateTime: '2024-01-01T11:00:00Z' }
      };

      const result = await dataProtection.processCalendarData([event], 'STANDARD');
      
      expect(result.safeData).toHaveLength(1);
      expect(result.safeData[0].metadata.hasAttendees).toBe(false);
    });

    test('should handle malformed conference data', async () => {
      const event = {
        summary: 'Meeting',
        description: 'Malformed zoom link: htp://zoom.us/invalid',
        conferenceData: {
          entryPoints: null
        }
      };

      const result = await dataProtection.processCalendarData([event], 'STANDARD');
      
      expect(result.safeData).toHaveLength(1);
      // Should not crash on malformed data
    });

    test('should reset state properly', () => {
      // Process some data to build up state
      calendarSanitizer.anonymizer.getAnonymizedPerson('test@company.com');
      calendarSanitizer.anonymizer.getAnonymizedOrganization('company.com');
      
      expect(calendarSanitizer.anonymizer.personMapping.size).toBe(1);
      expect(calendarSanitizer.anonymizer.organizationMapping.size).toBe(1);
      
      // Reset and verify clean state
      calendarSanitizer.reset();
      
      expect(calendarSanitizer.anonymizer.personMapping.size).toBe(0);
      expect(calendarSanitizer.anonymizer.organizationMapping.size).toBe(0);
    });
  });
});
