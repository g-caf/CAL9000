/**
 * Example usage of the data protection framework
 */

const DataProtectionService = require('../services/dataProtection');

// Example: Processing calendar data before sending to OpenAI
async function exampleCalendarProcessing() {
  console.log('=== Data Protection Framework Example ===\n');

  // Initialize the data protection service
  const dataProtection = DataProtectionService.createProductionInstance();

  // Example calendar data (what you might get from Google Calendar API)
  const calendarData = [
    {
      id: 'event_abc123def456',
      summary: 'Q1 Budget Review - Project Phoenix (Confidential)',
      description: `
        Quarterly budget review for Project Phoenix
        
        CONFIDENTIAL - Internal discussion only
        
        Agenda:
        - Revenue projections for ABC-1234
        - Cost analysis
        - Resource allocation
        
        Join Zoom Meeting:
        https://company.zoom.us/j/87654321098?pwd=VGhpcyBpcyBhIHRlc3Q
        
        Meeting ID: 876 5432 1098
        Passcode: phoenix2024
        
        Dial-in: +1-555-123-4567
      `,
      location: 'Executive Conference Room, Floor 15, 123 Corporate Plaza',
      creator: {
        email: 'cfo@company.com',
        displayName: 'Chief Financial Officer'
      },
      attendees: [
        {
          email: 'ceo@company.com',
          displayName: 'CEO',
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
      start: { dateTime: '2024-01-15T14:00:00-08:00' },
      end: { dateTime: '2024-01-15T15:30:00-08:00' },
      conferenceData: {
        entryPoints: [
          {
            entryPointType: 'video',
            uri: 'https://company.zoom.us/j/87654321098?pwd=VGhpcyBpcyBhIHRlc3Q'
          }
        ]
      }
    },
    {
      id: 'event_daily_standup',
      summary: 'Daily Standup - Team Alpha',
      description: 'Team sync for ongoing projects. Teams link: https://teams.microsoft.com/l/meetup-join/abc123',
      attendees: [
        { email: 'dev1@company.com', responseStatus: 'accepted' },
        { email: 'dev2@company.com', responseStatus: 'accepted' },
        { email: 'pm@company.com', responseStatus: 'accepted' }
      ],
      start: { dateTime: '2024-01-16T09:00:00-08:00' },
      end: { dateTime: '2024-01-16T09:30:00-08:00' },
      recurrence: ['FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR']
    }
  ];

  console.log('Original calendar data:');
  console.log('Event 1 summary:', calendarData[0].summary);
  console.log('Event 1 description preview:', calendarData[0].description.substring(0, 100) + '...');
  console.log('Event 1 attendees:', calendarData[0].attendees.map(a => a.email));
  console.log('Event 1 location:', calendarData[0].location);
  console.log();

  try {
    // Process with STANDARD protection level
    console.log('Processing with STANDARD protection level...');
    const result = await dataProtection.processCalendarData(calendarData, 'STANDARD');
    
    console.log('✅ Processing completed successfully!\n');
    
    console.log('Protected data (safe for OpenAI):');
    console.log('Event 1 summary:', result.safeData[0].summary);
    console.log('Event 1 description preview:', (result.safeData[0].description || '').substring(0, 100) + '...');
    console.log('Event 1 attendees:', result.safeData[0].attendees?.map(a => a.email) || []);
    console.log('Event 1 location:', result.safeData[0].location);
    console.log('Event 1 metadata:', result.safeData[0].metadata);
    console.log();

    // Show processing statistics
    console.log('Processing Statistics:');
    console.log('- Events processed:', result.stats.eventsProcessed);
    console.log('- Attendees anonymized:', result.stats.attendeesAnonymized);
    console.log('- Conference data removed:', result.stats.conferenceDataRemoved);
    console.log('- Processing time:', result.processingTime + 'ms');
    console.log();

    // Safety validation
    console.log('Safety Validation:');
    console.log('- Data is safe:', result.safetyValidation.isSafe ? '✅ YES' : '❌ NO');
    if (result.safetyValidation.issues.length > 0) {
      console.log('- Issues found:', result.safetyValidation.issues);
    }
    console.log();

    // Example: Simulate sending to OpenAI (this would be your actual OpenAI call)
    console.log('=== Simulating OpenAI Analysis ===');
    const openaiResponse = await simulateOpenAICall(result.safeData);
    console.log('OpenAI Response:', openaiResponse);
    console.log();

    // Example: Map results back to original data
    console.log('=== Mapping Results Back ===');
    const mappedResults = await dataProtection.processOpenAIResults(openaiResponse);
    console.log('Mapped results:', mappedResults);

  } catch (error) {
    console.error('❌ Error processing calendar data:', error.message);
  }
}

// Simulate an OpenAI API call (this is just for demonstration)
async function simulateOpenAICall(safeData) {
  // In reality, you would send safeData to OpenAI here
  return {
    analysis: 'Based on the calendar data, I can see you have a mix of executive meetings and daily team syncs.',
    suggestions: [
      'PERSON_1 has a high meeting load on Mondays',
      'PROJECT_1 requires significant executive attention',
      'Team meetings are well-distributed throughout the week'
    ],
    patterns: {
      meetingTypes: ['EXECUTIVE_MEETING', 'TEAM_SYNC'],
      peakTimes: ['14:00-15:30', '09:00-09:30'],
      recurringMeetings: 1
    }
  };
}

// Example: Different protection levels
async function demonstrateProtectionLevels() {
  console.log('\n=== Protection Levels Comparison ===\n');
  
  const dataProtection = DataProtectionService.createDevelopmentInstance();
  
  const testEvent = {
    summary: 'Confidential Project ABC-1234 Review',
    description: 'Budget discussion. Zoom: https://zoom.us/j/123456',
    attendees: [{ email: 'john.doe@company.com' }],
    start: { dateTime: '2024-01-01T10:00:00Z' },
    end: { dateTime: '2024-01-01T11:00:00Z' }
  };

  const levels = ['MINIMAL', 'STANDARD', 'MAXIMUM'];
  
  for (const level of levels) {
    console.log(`--- ${level} Protection ---`);
    const result = await dataProtection.processCalendarData([testEvent], level);
    const event = result.safeData[0];
    
    console.log('Summary:', event.summary || '[REMOVED]');
    console.log('Description:', (event.description || '[REMOVED]').substring(0, 50) + '...');
    console.log('Attendees:', event.attendees?.length ? event.attendees[0].email : '[REMOVED]');
    console.log('Has metadata:', !!event.metadata);
    console.log();
  }
}

// Example: Custom configuration
async function demonstrateCustomConfiguration() {
  console.log('\n=== Custom Configuration Example ===\n');
  
  // Create custom configured instance
  const customProtection = new DataProtectionService({
    strictMode: true,
    enableLogging: true,
    allowMinimalLocation: false,
    preserveTimePatterns: true
  });

  const testData = [{
    summary: 'Test Meeting',
    location: 'Secret Location',
    start: { dateTime: '2024-01-01T10:00:00Z' },
    end: { dateTime: '2024-01-01T11:00:00Z' }
  }];

  try {
    const result = await customProtection.processCalendarData(testData, 'STANDARD');
    console.log('Custom configuration result:', result.safeData[0]);
  } catch (error) {
    console.log('Custom configuration error (expected in strict mode):', error.message);
  }
}

// Run all examples
async function runAllExamples() {
  try {
    await exampleCalendarProcessing();
    await demonstrateProtectionLevels();
    await demonstrateCustomConfiguration();
    
    console.log('\n=== All Examples Completed Successfully! ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in other files
module.exports = {
  exampleCalendarProcessing,
  demonstrateProtectionLevels,
  demonstrateCustomConfiguration,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}
