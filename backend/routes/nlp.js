const express = require('express');
const router = express.Router();
const { 
  parseCalendarQuery, 
  analyzeCalendarIntelligence, 
  executeSmartScheduling, 
  routeIntelligentQuery 
} = require('../services/llm');

// Parse calendar query using LLM
router.post('/parse', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Received parse request:', message);
    
    const result = await parseCalendarQuery(message);
    
    res.json({
      success: true,
      parsed: result,
      originalMessage: message
    });
    
  } catch (error) {
    console.error('NLP parsing error:', error);
    res.status(500).json({ 
      error: 'Failed to parse message',
      details: error.message
    });
  }
});

// Intelligent calendar analysis endpoint
router.post('/analyze', async (req, res) => {
  try {
    const { events, analysisType, options = {} } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Calendar events array is required' });
    }
    
    if (!analysisType) {
      return res.status(400).json({ error: 'Analysis type is required' });
    }
    
    console.log(`Received analysis request: ${analysisType} for ${events.length} events`);
    
    const result = await analyzeCalendarIntelligence(events, analysisType, options);
    
    res.json({
      success: true,
      analysisType,
      result,
      metadata: {
        eventsAnalyzed: events.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Calendar analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze calendar data',
      details: error.message
    });
  }
});

// Smart scheduling endpoint
router.post('/schedule', async (req, res) => {
  try {
    const { calendarEvents, schedulingRequest } = req.body;
    
    if (!calendarEvents || !Array.isArray(calendarEvents)) {
      return res.status(400).json({ error: 'Calendar events array is required' });
    }
    
    if (!schedulingRequest || !schedulingRequest.type) {
      return res.status(400).json({ error: 'Scheduling request with type is required' });
    }
    
    console.log(`Received scheduling request: ${schedulingRequest.type}`);
    
    const result = await executeSmartScheduling(calendarEvents, schedulingRequest);
    
    res.json({
      success: true,
      schedulingType: schedulingRequest.type,
      result,
      metadata: {
        calendarEventsProcessed: calendarEvents.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Smart scheduling error:', error);
    res.status(500).json({ 
      error: 'Failed to execute smart scheduling',
      details: error.message
    });
  }
});

// Intelligent query routing endpoint
router.post('/route', async (req, res) => {
  console.log('=== NLP ROUTE CALLED ===', new Date().toISOString());
  console.log('Request body keys:', Object.keys(req.body));
  console.log('ForceIntelligentAnalysis:', req.body.forceIntelligentAnalysis);
  
  try {
    const { 
      message, 
      calendarEvents = null, 
      forceIntelligentAnalysis = false,
      analysisType = null 
    } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Routing intelligent query:', message);
    
    let routing;
    let result = null;
    
    // Force intelligent analysis if requested (for availability calculations)
    if (forceIntelligentAnalysis && analysisType && calendarEvents) {
      console.log(`Forcing intelligent analysis: ${analysisType}`);
      routing = {
        type: 'intelligence',
        analysisType: analysisType,
        options: extractOptionsFromMessage(message), // Extract duration, etc.
        requiresCalendarData: true
      };
      
      result = await analyzeCalendarIntelligence(
        calendarEvents, 
        routing.analysisType, 
        routing.options
      );
    } else {
      // Normal routing
      routing = await routeIntelligentQuery(message, calendarEvents);
      
      if (routing.type === 'intelligence') {
        if (!calendarEvents || !Array.isArray(calendarEvents)) {
          return res.status(400).json({ 
            error: 'Calendar events required for intelligent analysis',
            routing
          });
        }
        
        result = await analyzeCalendarIntelligence(
          calendarEvents, 
          routing.analysisType, 
          routing.options
        );
      } else if (routing.type === 'parsing') {
        result = await parseCalendarQuery(message);
      }
    }
    
    res.json({
      success: true,
      originalMessage: message,
      routing,
      result
    });
    
  } catch (error) {
    console.error('Query routing error:', error);
    res.status(500).json({ 
      error: 'Failed to route and process query',
      details: error.message
    });
  }
});

// Helper function to extract options from message for forced analysis
function extractOptionsFromMessage(message) {
  const options = {};
  
  // Extract duration
  const durationMatch = message.match(/(\d+)\s+(minute|hour|min|hr)s?/i);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    options.duration = unit.startsWith('h') ? amount * 60 : amount;
  } else {
    options.duration = 30; // Default 30 minutes
  }
  
  // Extract urgency
  if (message.toLowerCase().includes('urgent') || message.toLowerCase().includes('asap')) {
    options.urgency = 'urgent';
  } else if (message.toLowerCase().includes('soon')) {
    options.urgency = 'high';
  } else {
    options.urgency = 'normal';
  }
  
  // Set attendee count (for availability queries, typically 2 people)
  options.attendeeCount = 2;
  
  // Set time range
  if (message.toLowerCase().includes('next week')) {
    options.timeRange = 'next_week';
  } else if (message.toLowerCase().includes('this week')) {
    options.timeRange = 'this_week';
  } else if (message.toLowerCase().includes('tomorrow')) {
    options.timeRange = 'tomorrow';
  } else if (message.toLowerCase().includes('today')) {
    options.timeRange = 'today';
  } else {
    options.timeRange = 'this_week';
  }
  
  return options;
}

module.exports = router;
