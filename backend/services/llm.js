const OpenAI = require('openai');
const CalendarIntelligence = require('./calendarIntelligence');
const SchedulingEngine = require('./schedulingEngine');

// Initialize OpenAI only if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Initialize intelligent systems
const calendarIntelligence = new CalendarIntelligence();
const schedulingEngine = new SchedulingEngine();

async function parseCalendarQuery(message) {
  console.log('Parsing with LLM:', message);
  
  const prompt = `Parse this calendar query into JSON. Be precise with entity extraction and intent classification.

Query: "${message}"

CRITICAL MAPPING RULES (follow exactly):
- "quinn" → "sqs" (always!)
- "sqs" → "sqs" 
- "sg" → "sqs"
- "my" → "adrienne"
- "me" → "adrienne" 
- "i" → "adrienne"

INTENT CLASSIFICATION RULES:
- "find", "available", "free time", "open slots", "when can" → "find_availability" (calculate free time slots)
- "show", "what meetings", "what's on", "events" → "show_events" (display existing events)
- "schedule", "book", "set up meeting" → "schedule_meeting" (intelligent scheduling)
- "my calendar", general queries → "calendar_view" (show overview)

Examples:
- "Find 30 minutes tomorrow" → "intent": "find_availability", "needsAvailabilityCalculation": true
- "What's my availability on Monday?" → "intent": "find_availability", "needsAvailabilityCalculation": true  
- "Show my meetings today" → "intent": "show_events", "needsAvailabilityCalculation": false
- "What is quinn doing tomorrow?" → "intent": "show_events", "person": "sqs", "needsAvailabilityCalculation": false

Return only valid JSON:
{
  "intent": "find_availability|show_events|schedule_meeting|calendar_view",
  "person": "sqs|adrienne|null",
  "duration": "30 minutes|1 hour|null", 
  "dateRange": "today|tomorrow|next week|this week|null",
  "meetingType": "1:1|sync|standup|call|meeting|null",
  "companyName": "company name|null",
  "isPersonalQuery": true/false,
  "needsAvailabilityCalculation": true/false
}`;

  try {
    if (!openai) {
      throw new Error('OpenAI not available - API key not configured');
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 200
    });

    const content = response.choices[0].message.content.trim();
    console.log('LLM response:', content);
    
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('Parsed result:', parsed);
    
    return parsed;
    
  } catch (error) {
    console.error('LLM parsing error:', error);
    
    // Fallback to simple regex for basic cases
    return fallbackParsing(message);
  }
}

function fallbackParsing(message) {
  console.log('Using fallback parsing for:', message);
  
  const lowerMessage = message.toLowerCase();
  
  // Simple fallbacks for critical cases
  if (lowerMessage.includes('looking for') && lowerMessage.includes('minutes')) {
    return {
      intent: 'scheduling',
      person: lowerMessage.includes('quinn') ? 'sqs' : null,
      duration: lowerMessage.match(/(\d+)\s+(minute|hour)s?/)?.[0] || null,
      dateRange: lowerMessage.includes('next week') ? 'next week' : null,
      meetingType: lowerMessage.includes('call') ? 'call' : 'meeting',
      companyName: null,
      isPersonalQuery: false
    };
  }
  
  return {
    intent: 'calendar_view',
    person: 'adrienne',
    duration: null,
    dateRange: null,
    meetingType: null,
    companyName: null,
    isPersonalQuery: true
  };
}

/**
 * Analyze calendar data with AI intelligence
 */
async function analyzeCalendarIntelligence(events, analysisType, options = {}) {
  try {
    console.log(`Running calendar intelligence analysis: ${analysisType}`);
    
    const result = await calendarIntelligence.analyzeCalendarData(events, analysisType, options);
    
    console.log('Calendar intelligence analysis completed');
    return result;
    
  } catch (error) {
    console.error('Calendar intelligence error:', error);
    throw new Error(`Calendar analysis failed: ${error.message}`);
  }
}

/**
 * Smart scheduling operations
 */
async function executeSmartScheduling(calendarEvents, schedulingRequest) {
  try {
    console.log(`Executing smart scheduling: ${schedulingRequest.type}`);
    
    const result = await schedulingEngine.scheduleIntelligently(calendarEvents, schedulingRequest);
    
    console.log('Smart scheduling completed');
    return result;
    
  } catch (error) {
    console.error('Smart scheduling error:', error);
    throw new Error(`Smart scheduling failed: ${error.message}`);
  }
}

/**
 * Intelligent query routing - determines if query needs AI calendar analysis
 */
async function routeIntelligentQuery(message, calendarEvents = null) {
  const lowerMessage = message.toLowerCase();
  
  // Patterns that indicate need for calendar intelligence
  const intelligencePatterns = [
    /find.*(optimal|best).*(time|slot)/i,
    /when.*should.*meet/i,
    /analyze.*calendar/i,
    /optimize.*schedule/i,
    /scheduling.*patterns/i,
    /focus.*time/i,
    /suggest.*meeting/i,
    /resolve.*conflict/i,
    /improve.*calendar/i
  ];
  
  const needsIntelligence = intelligencePatterns.some(pattern => pattern.test(message));
  
  if (needsIntelligence && calendarEvents && calendarEvents.length > 0) {
    // Route to intelligent analysis
    const analysisType = determineAnalysisType(message);
    const options = extractAnalysisOptions(message);
    
    return {
      type: 'intelligence',
      analysisType,
      options,
      requiresCalendarData: true
    };
  } else {
    // Route to traditional query parsing
    return {
      type: 'parsing',
      requiresCalendarData: false
    };
  }
}

/**
 * Determine what type of AI analysis to perform
 */
function determineAnalysisType(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('conflict') || lowerMessage.includes('schedule') && lowerMessage.includes('meeting')) {
    return 'conflict_resolution';
  }
  
  if (lowerMessage.includes('pattern') || lowerMessage.includes('analyze')) {
    return 'pattern_recognition';
  }
  
  if (lowerMessage.includes('focus') || lowerMessage.includes('deep work')) {
    return 'focus_time_analysis';
  }
  
  if (lowerMessage.includes('optimal') || lowerMessage.includes('best time')) {
    return 'availability_optimization';
  }
  
  if (lowerMessage.includes('multiple') || lowerMessage.includes('group') || lowerMessage.includes('team')) {
    return 'multi_person_scheduling';
  }
  
  if (lowerMessage.includes('meeting') && (lowerMessage.includes('suggest') || lowerMessage.includes('recommend'))) {
    return 'meeting_intelligence';
  }
  
  // Default to conflict resolution for general scheduling queries
  return 'conflict_resolution';
}

/**
 * Extract options for AI analysis from user message
 */
function extractAnalysisOptions(message) {
  const options = {};
  
  // Extract duration
  const durationMatch = message.match(/(\d+)\s+(minute|hour|min|hr)s?/i);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    options.duration = unit.startsWith('h') ? amount * 60 : amount;
  }
  
  // Extract urgency
  if (message.toLowerCase().includes('urgent') || message.toLowerCase().includes('asap')) {
    options.urgency = 'urgent';
  } else if (message.toLowerCase().includes('soon')) {
    options.urgency = 'high';
  }
  
  // Extract time range
  if (message.toLowerCase().includes('next week')) {
    options.timeRange = 'next_week';
  } else if (message.toLowerCase().includes('this week')) {
    options.timeRange = 'this_week';
  } else if (message.toLowerCase().includes('tomorrow')) {
    options.timeRange = 'tomorrow';
  } else if (message.toLowerCase().includes('today')) {
    options.timeRange = 'today';
  }
  
  // Extract meeting type
  if (message.toLowerCase().includes('1:1') || message.toLowerCase().includes('one on one')) {
    options.meetingType = 'one_on_one';
  } else if (message.toLowerCase().includes('standup')) {
    options.meetingType = 'standup';
  } else if (message.toLowerCase().includes('sync')) {
    options.meetingType = 'team_sync';
  } else if (message.toLowerCase().includes('interview')) {
    options.meetingType = 'interview';
  } else if (message.toLowerCase().includes('client')) {
    options.meetingType = 'client_call';
  }
  
  return options;
}

module.exports = {
  parseCalendarQuery,
  analyzeCalendarIntelligence,
  executeSmartScheduling,
  routeIntelligentQuery
};
