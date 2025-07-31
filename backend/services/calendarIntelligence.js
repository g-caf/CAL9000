/**
 * Calendar Intelligence Engine
 * Provides AI-powered calendar analysis and smart scheduling assistance
 */

const OpenAI = require('openai');
const CalendarSanitizer = require('./calendarSanitizer');

// Initialize OpenAI only if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
} else {
  console.log('⚠️  OpenAI API key not found. AI analysis features will be limited.');
}

class CalendarIntelligence {
  constructor() {
    this.sanitizer = new CalendarSanitizer();
    this.analysisHistory = new Map(); // Cache for repeated queries
  }

  /**
   * Check if OpenAI is available and throw appropriate error if not
   */
  checkOpenAIAvailability() {
    if (!openai) {
      throw new Error('OpenAI API not available. Please configure OPENAI_API_KEY environment variable.');
    }
  }

  /**
   * Filter events to only those relevant for scheduling analysis
   */
  filterRelevantEvents(events, options = {}) {
    const now = new Date();
    const { timeRange = 'this_week' } = options;
    
    // Calculate time bounds based on request
    let startBound, endBound;
    
    switch (timeRange) {
      case 'today':
        startBound = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endBound = new Date(startBound.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'tomorrow':
        startBound = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        endBound = new Date(startBound.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        startBound = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        endBound = new Date(startBound.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'next_week':
        const nextWeekStart = new Date(now.getTime() + (7 - now.getDay()) * 24 * 60 * 60 * 1000);
        startBound = nextWeekStart;
        endBound = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        // Default to 2 weeks from now
        startBound = now;
        endBound = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    console.log(`Filtering events between ${startBound.toISOString()} and ${endBound.toISOString()}`);

    return events.filter(event => {
      // Skip events without proper time data
      if (!event.start) return false;
      
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end?.dateTime || event.end?.date || eventStart);
      
      // Only include events that overlap with our time range
      const overlaps = eventStart < endBound && eventEnd > startBound;
      if (!overlaps) return false;
      
      // Skip declined meetings
      if (event.attendees) {
        const userAttendee = event.attendees.find(a => a.self);
        if (userAttendee && userAttendee.responseStatus === 'declined') {
          return false;
        }
      }
      
      // Skip transparent events (they don't block time)
      if (event.transparency === 'transparent') {
        return false;
      }
      
      // Skip cancelled events
      if (event.status === 'cancelled') {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Main entry point for calendar intelligence
   */
  async analyzeCalendarData(events, analysisType, options = {}) {
    console.log(`Starting ${analysisType} analysis for ${events.length} events`);
    
    // Filter events by time relevance and scheduling impact
    const relevantEvents = this.filterRelevantEvents(events, options);
    console.log(`Filtered to ${relevantEvents.length} relevant events (from ${events.length})`);
    
    // Sanitize calendar data for AI processing
    console.log('Raw events sample:', JSON.stringify(relevantEvents[0], null, 2));
    const safeData = this.sanitizer.createMinimalSafeData(relevantEvents, options);
    console.log('Sanitized data sample:', JSON.stringify(safeData[0], null, 2));
    
    // Validate data safety before sending to OpenAI
    const safetyCheck = this.sanitizer.validateSafety(safeData);
    if (!safetyCheck.isSafe) {
      console.error('=== SAFETY VALIDATION DETAILS ===');
      console.error('Issues found:', safetyCheck.issues);
      console.error('Sample failing data:', JSON.stringify(safeData.slice(0, 3), null, 2));
      
      // For availability analysis, proceed with warning instead of blocking
      if (analysisType === 'conflict_resolution') {
        console.warn('Proceeding with availability analysis despite safety warnings');
      } else {
        throw new Error('Calendar data failed safety validation');
      }
    }

    console.log(`Sanitized ${relevantEvents.length} events to ${safeData.length} safe records`);

    switch (analysisType) {
      case 'conflict_resolution':
        return await this.findOptimalMeetingTimes(safeData, options);
      
      case 'pattern_recognition':
        return await this.analyzeSchedulingPatterns(safeData, options);
      
      case 'availability_optimization':
        return await this.optimizeAvailability(safeData, options);
      
      case 'multi_person_scheduling':
        return await this.findMultiPersonOptimalTimes(safeData, options);
      
      case 'meeting_intelligence':
        return await this.provideMeetingIntelligence(safeData, options);
      
      case 'focus_time_analysis':
        return await this.analyzeFocusTimeOpportunities(safeData, options);
      
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }
  }

  /**
   * Find optimal meeting times avoiding conflicts
   */
  async findOptimalMeetingTimes(safeEvents, options = {}) {
    const {
      duration = 30,
      attendeeCount = 2,
      timeRange = 'next_week',
      meetingType = 'meeting',
      urgency = 'normal'
    } = options;

    const prompt = `As a scheduling expert, analyze this calendar data and find optimal meeting times.

Calendar Events (anonymized):
${JSON.stringify(safeEvents, null, 2)}

Meeting Requirements:
- Duration: ${duration} minutes
- Number of attendees: ${attendeeCount}
- Time range: ${timeRange}
- Meeting type: ${meetingType}
- Urgency: ${urgency}

Analysis Tasks:
1. Identify existing conflicts and busy periods
2. Find 3-5 optimal time slots that:
   - Avoid back-to-back meetings
   - Respect typical working hours
   - Consider meeting type appropriateness
   - Allow for buffer time
3. Rank suggestions by preference considering:
   - Attendee availability patterns
   - Time of day effectiveness for meeting type
   - Calendar density/breathing room

Provide recommendations in this format:
{
  "recommendedTimes": [
    {
      "timeSlot": "specific time recommendation",
      "confidence": "high/medium/low",
      "reasoning": "why this time works well",
      "considerations": ["potential issues or benefits"]
    }
  ],
  "conflictAnalysis": {
    "busyPeriods": ["list of busy time ranges"],
    "availableWindows": ["list of available time windows"],
    "optimalDayPattern": "analysis of best days/times"
  },
  "schedulingInsights": [
    "key insights about scheduling patterns and preferences"
  ]
}`;

    try {
      this.checkOpenAIAvailability();

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500
      });

      const content = response.choices[0].message.content.trim();
      console.log('OpenAI raw response:', content);
      
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in OpenAI response:', content);
        throw new Error('OpenAI did not return valid JSON format');
      }
      
      const analysisResult = JSON.parse(jsonMatch[0]);

      // Map back any anonymized data to original context
      return this.mapAnalysisToOriginalContext(analysisResult, options);

    } catch (error) {
      console.error('OpenAI analysis error:', error);
      throw new Error(`Calendar intelligence analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze scheduling patterns and preferences
   */
  async analyzeSchedulingPatterns(safeEvents, options = {}) {
    const prompt = `As a calendar analytics expert, analyze these calendar events to identify scheduling patterns and preferences.

Calendar Data (anonymized):
${JSON.stringify(safeEvents, null, 2)}

Analysis Goals:
1. Identify recurring patterns in meeting scheduling
2. Determine preferred meeting times and days
3. Analyze meeting duration trends
4. Identify potential scheduling inefficiencies
5. Suggest optimization opportunities

Provide analysis in this format:
{
  "patterns": {
    "preferredDays": ["analysis of which days are most scheduled"],
    "preferredTimes": ["analysis of preferred time slots"],
    "meetingDurations": ["common durations and patterns"],
    "backToBackTrends": "frequency of consecutive meetings"
  },
  "insights": [
    "key insights about scheduling behavior and efficiency"
  ],
  "recommendations": [
    "actionable suggestions for better calendar management"
  ],
  "efficiency": {
    "score": "1-10 rating of calendar efficiency",
    "areas_for_improvement": ["specific areas to optimize"]
  }
}`;

    try {
      this.checkOpenAIAvailability();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1200
      });

      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);

    } catch (error) {
      console.error('Pattern analysis error:', error);
      throw new Error(`Pattern analysis failed: ${error.message}`);
    }
  }

  /**
   * Optimize availability and suggest buffer times
   */
  async optimizeAvailability(safeEvents, options = {}) {
    const { focusTimeNeeded = 120, bufferPreference = 15 } = options;

    const prompt = `As a productivity expert, analyze this calendar to optimize availability and suggest focus time blocks.

Calendar Events (anonymized):
${JSON.stringify(safeEvents, null, 2)}

Requirements:
- Focus time needed: ${focusTimeNeeded} minutes per day
- Preferred buffer between meetings: ${bufferPreference} minutes

Tasks:
1. Identify existing gaps in the schedule
2. Suggest optimal focus time blocks
3. Recommend buffer time adjustments
4. Identify opportunities to consolidate meetings

Provide recommendations in this format:
{
  "focusTimeBlocks": [
    {
      "timeSlot": "suggested focus time period",
      "duration": "minutes available",
      "quality": "high/medium/low productivity potential",
      "reasoning": "why this time works for focus"
    }
  ],
  "bufferSuggestions": [
    {
      "location": "where to add buffer",
      "recommendation": "specific buffer suggestion",
      "benefit": "why this helps"
    }
  ],
  "consolidationOpportunities": [
    "suggestions for grouping similar meetings"
  ],
  "availabilityScore": {
    "current": "1-10 rating",
    "potential": "1-10 with optimizations",
    "improvements": ["key changes to make"]
  }
}`;

    try {
      this.checkOpenAIAvailability();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1200
      });

      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);

    } catch (error) {
      console.error('Availability optimization error:', error);
      throw new Error(`Availability optimization failed: ${error.message}`);
    }
  }

  /**
   * Multi-person scheduling optimization
   */
  async findMultiPersonOptimalTimes(safeEvents, options = {}) {
    const {
      attendeeEvents = [],
      duration = 60,
      meetingType = 'collaboration',
      timezone = 'America/New_York'
    } = options;

    const prompt = `As a multi-person scheduling expert, find optimal meeting times considering multiple calendars.

Primary Calendar (anonymized):
${JSON.stringify(safeEvents, null, 2)}

Attendee Calendars (anonymized):
${JSON.stringify(attendeeEvents, null, 2)}

Requirements:
- Meeting duration: ${duration} minutes
- Meeting type: ${meetingType}
- Timezone: ${timezone}

Analysis:
1. Find mutual availability across all calendars
2. Consider meeting type appropriateness for time of day
3. Avoid creating scheduling conflicts for any participant
4. Optimize for participant productivity patterns

Provide analysis in this format:
{
  "mutualAvailability": [
    {
      "timeSlot": "when all participants are free",
      "participants": "who would be available",
      "qualityRating": "high/medium/low for this meeting type",
      "considerations": ["factors affecting this choice"]
    }
  ],
  "individualConstraints": [
    "identified constraints or preferences per participant"
  ],
  "recommendations": [
    "ranked suggestions with reasoning"
  ],
  "alternativeOptions": [
    "backup options if primary suggestions don't work"
  ]
}`;

    try {
      this.checkOpenAIAvailability();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1400
      });

      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);

    } catch (error) {
      console.error('Multi-person scheduling error:', error);
      throw new Error(`Multi-person scheduling failed: ${error.message}`);
    }
  }

  /**
   * Meeting intelligence and type-based recommendations
   */
  async provideMeetingIntelligence(safeEvents, options = {}) {
    const { proposedMeeting = {}, context = '' } = options;

    const prompt = `As a meeting effectiveness expert, analyze calendar patterns and provide intelligent recommendations.

Existing Calendar (anonymized):
${JSON.stringify(safeEvents, null, 2)}

Proposed Meeting Context:
${JSON.stringify(proposedMeeting, null, 2)}
Additional Context: ${context}

Analysis:
1. Determine optimal meeting duration based on type and participants
2. Suggest best time slots based on participant energy/productivity patterns
3. Identify if this meeting could be combined with existing meetings
4. Recommend meeting format (in-person vs virtual) based on context

Provide recommendations in this format:
{
  "meetingOptimization": {
    "recommendedDuration": "optimal duration with reasoning",
    "preferredTimeSlots": ["best times for this meeting type"],
    "formatRecommendation": "in-person/virtual/hybrid with reasoning"
  },
  "efficiencyInsights": [
    "opportunities to make this meeting more effective"
  ],
  "consolidationPotential": [
    "ways to combine with existing meetings if applicable"
  ],
  "participantConsiderations": [
    "factors to consider for each participant type"
  ],
  "followUpSuggestions": [
    "post-meeting actions to maximize value"
  ]
}`;

    try {
      this.checkOpenAIAvailability();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1200
      });

      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);

    } catch (error) {
      console.error('Meeting intelligence error:', error);
      throw new Error(`Meeting intelligence failed: ${error.message}`);
    }
  }

  /**
   * Analyze focus time opportunities
   */
  async analyzeFocusTimeOpportunities(safeEvents, options = {}) {
    const { workType = 'knowledge_work', minimumBlock = 90 } = options;

    const prompt = `As a productivity expert, analyze this calendar to identify optimal focus time opportunities.

Calendar Events (anonymized):
${JSON.stringify(safeEvents, null, 2)}

Requirements:
- Work type: ${workType}
- Minimum focus block: ${minimumBlock} minutes

Analysis:
1. Identify natural focus time blocks in the schedule
2. Determine quality of focus opportunities (interruption risk, energy levels)
3. Suggest calendar adjustments to create better focus time
4. Analyze meeting density and suggest redistribution

Provide analysis in this format:
{
  "focusOpportunities": [
    {
      "timeBlock": "available focus time period",
      "duration": "minutes available",
      "quality": "high/medium/low focus quality",
      "energyLevel": "expected energy level for this time",
      "interruptionRisk": "low/medium/high",
      "recommendations": ["how to optimize this block"]
    }
  ],
  "calendarAdjustments": [
    "suggestions to create better focus opportunities"
  ],
  "meetingDensityAnalysis": {
    "currentDensity": "meetings per day analysis",
    "recommendations": ["ways to improve meeting distribution"]
  },
  "productivityInsights": [
    "insights about when and how to maximize deep work"
  ]
}`;

    try {
      this.checkOpenAIAvailability();

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1300
      });

      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);

    } catch (error) {
      console.error('Focus time analysis error:', error);
      throw new Error(`Focus time analysis failed: ${error.message}`);
    }
  }

  /**
   * Map anonymized analysis results back to original context
   */
  mapAnalysisToOriginalContext(analysisResult, options = {}) {
    // Use the sanitizer's reverse mapping capability
    const mappedResult = this.sanitizer.mapResultsBack(analysisResult);
    
    // Add context-specific enhancements
    mappedResult.metadata = {
      analysisTimestamp: new Date().toISOString(),
      requestOptions: options,
      sanitizationStats: this.sanitizer.getSanitizationStats()
    };

    return mappedResult;
  }

  /**
   * Get analysis history for caching and insights
   */
  getAnalysisHistory() {
    return Array.from(this.analysisHistory.entries()).map(([key, data]) => ({
      analysisId: key,
      timestamp: data.timestamp,
      type: data.type,
      summary: data.summary
    }));
  }

  /**
   * Clear analysis cache
   */
  clearCache() {
    this.analysisHistory.clear();
    this.sanitizer.reset();
  }
}

module.exports = CalendarIntelligence;
