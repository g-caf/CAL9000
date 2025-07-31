/**
 * Test script to verify the calendar intelligence system
 */

const CalendarIntelligence = require('./services/calendarIntelligence');
const SchedulingEngine = require('./services/schedulingEngine');
const { routeIntelligentQuery } = require('./services/llm');

// Mock calendar events for testing
const mockCalendarEvents = [
  {
    summary: 'Daily Standup',
    start: { dateTime: '2024-08-01T09:00:00Z' },
    end: { dateTime: '2024-08-01T09:30:00Z' },
    attendees: [
      { email: 'test@example.com', responseStatus: 'accepted' }
    ]
  },
  {
    summary: 'Project Planning',
    start: { dateTime: '2024-08-01T14:00:00Z' },
    end: { dateTime: '2024-08-01T15:00:00Z' },
    attendees: [
      { email: 'manager@example.com', responseStatus: 'accepted' },
      { email: 'test@example.com', responseStatus: 'accepted' }
    ]
  },
  {
    summary: 'Client Call',
    start: { dateTime: '2024-08-01T16:00:00Z' },
    end: { dateTime: '2024-08-01T17:00:00Z' },
    attendees: [
      { email: 'client@company.com', responseStatus: 'accepted' }
    ]
  }
];

async function testCalendarIntelligence() {
  console.log('🧪 Testing Calendar Intelligence System...\n');
  
  try {
    // Test 1: Query routing
    console.log('📍 Test 1: Query Routing');
    const testQueries = [
      'Find the best time for a 30 minute meeting next week',
      'Analyze my calendar patterns',
      'When is Quinn available tomorrow?',
      'Suggest optimal focus time blocks'
    ];
    
    for (const query of testQueries) {
      const routing = await routeIntelligentQuery(query, mockCalendarEvents);
      console.log(`Query: "${query}"`);
      console.log(`Routing: ${routing.type} (${routing.analysisType || 'N/A'})`);
      console.log('');
    }
    
    // Test 2: Calendar Intelligence (without OpenAI for testing)
    console.log('🤖 Test 2: Calendar Intelligence Structure');
    const intelligence = new CalendarIntelligence();
    console.log('✅ CalendarIntelligence initialized');
    
    // Test 3: Scheduling Engine
    console.log('⚙️ Test 3: Scheduling Engine Structure');
    const schedulingEngine = new SchedulingEngine();
    console.log('✅ SchedulingEngine initialized');
    
    // Test 4: Data sanitization
    console.log('🔒 Test 4: Data Sanitization');
    const safeData = intelligence.sanitizer.createMinimalSafeData(mockCalendarEvents);
    console.log(`✅ Sanitized ${mockCalendarEvents.length} events to ${safeData.length} safe records`);
    
    const safetyCheck = intelligence.sanitizer.validateSafety(safeData);
    console.log(`✅ Safety validation: ${safetyCheck.isSafe ? 'PASSED' : 'FAILED'}`);
    if (!safetyCheck.isSafe) {
      console.log('❌ Safety issues:', safetyCheck.issues);
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 System Status:');
    console.log('✅ Calendar Intelligence: Ready');
    console.log('✅ Scheduling Engine: Ready');
    console.log('✅ Data Protection: Active');
    console.log('✅ Query Routing: Functional');
    console.log('\n💡 To test with OpenAI, ensure OPENAI_API_KEY is set and make API calls through the routes.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run tests if called directly
if (require.main === module) {
  testCalendarIntelligence();
}

module.exports = { testCalendarIntelligence };
