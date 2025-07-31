/**
 * Jest test setup file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';

// Global test utilities
global.testUtils = {
  // Helper to create mock calendar events
  createMockEvent: (overrides = {}) => ({
    id: 'test_event_123',
    summary: 'Test Meeting',
    description: 'Test description',
    location: 'Test Location',
    creator: {
      email: 'creator@test.com',
      displayName: 'Test Creator'
    },
    attendees: [
      {
        email: 'attendee1@test.com',
        displayName: 'Test Attendee 1',
        responseStatus: 'accepted'
      }
    ],
    start: { dateTime: '2024-01-01T10:00:00Z' },
    end: { dateTime: '2024-01-01T11:00:00Z' },
    ...overrides
  }),

  // Helper to create events with conference data
  createConferenceEvent: (platform = 'zoom') => {
    const events = {
      zoom: {
        summary: 'Zoom Meeting',
        description: 'Join: https://zoom.us/j/1234567890?pwd=test123',
        conferenceData: {
          entryPoints: [
            {
              entryPointType: 'video',
              uri: 'https://zoom.us/j/1234567890?pwd=test123'
            }
          ]
        }
      },
      teams: {
        summary: 'Teams Meeting',
        description: 'Join: https://teams.microsoft.com/l/meetup-join/abc123',
        location: 'https://teams.microsoft.com/l/meetup-join/abc123'
      },
      meet: {
        summary: 'Google Meet',
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
        description: 'Google Meet: https://meet.google.com/abc-defg-hij'
      }
    };
    
    return global.testUtils.createMockEvent(events[platform] || events.zoom);
  },

  // Helper to create events with sensitive data
  createSensitiveEvent: () => global.testUtils.createMockEvent({
    summary: 'Confidential Project ABC-1234 Review',
    description: `
      CONFIDENTIAL - Budget review for Q1
      Meeting ID: 123-456-789
      Passcode: secret123
      Contact: john.doe@company.com or +1-555-123-4567
    `,
    attendees: [
      {
        email: 'ceo@company.com',
        displayName: 'Chief Executive Officer',
        responseStatus: 'accepted'
      },
      {
        email: 'external@client.com',
        displayName: 'External Contact',
        responseStatus: 'tentative'
      }
    ],
    extendedProperties: {
      private: {
        'project-code': 'ABC-1234',
        'budget-category': 'confidential'
      }
    }
  })
};

// Console override for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: originalConsole.error,
  warn: originalConsole.warn,
  info: jest.fn(),
  debug: jest.fn()
};

// Reset console mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
