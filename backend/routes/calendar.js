const express = require('express');
const CalendarService = require('../services/calendarService');
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please authenticate with Google first'
    });
  }
  next();
};

// Get calendar events
router.get('/events', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, calendarId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      });
    }

    const calendarService = new CalendarService(req.user.accessToken);
    const events = await calendarService.getEvents(
      new Date(startDate),
      new Date(endDate),
      calendarId
    );

    res.json({
      success: true,
      events: events,
      count: events.length
    });
  } catch (error) {
    console.error('❌ Calendar events error:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      message: error.message
    });
  }
});

// Check conflicts for time slots
router.post('/check-conflicts', requireAuth, async (req, res) => {
  try {
    const { timeSlots, bufferMinutes = 15 } = req.body;
    
    if (!timeSlots || !Array.isArray(timeSlots)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'timeSlots array is required'
      });
    }

    const calendarService = new CalendarService(req.user.accessToken);
    const results = [];

    for (const slot of timeSlots) {
      const startTime = new Date(slot.start);
      const endTime = new Date(slot.end);
      
      // Get events for this time period
      const dayStart = new Date(startTime);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(endTime);
      dayEnd.setHours(23, 59, 59, 999);
      
      const events = await calendarService.getEvents(dayStart, dayEnd);
      const conflictResult = calendarService.checkConflicts(events, startTime, endTime);
      
      results.push({
        timeSlot: slot,
        conflict: conflictResult,
        availableTime: conflictResult.status === 'free' ? slot : null
      });
    }

    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    console.error('❌ Conflict check error:', error);
    res.status(500).json({
      error: 'Failed to check conflicts',
      message: error.message
    });
  }
});

// Find free time slots
router.post('/find-free-time', requireAuth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      durationMinutes = 30, 
      workingHours = { start: 9, end: 17 },
      maxResults = 10
    } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'startDate and endDate are required'
      });
    }

    const calendarService = new CalendarService(req.user.accessToken);
    const freeSlots = await calendarService.findFreeTime(
      new Date(startDate),
      new Date(endDate),
      durationMinutes,
      workingHours
    );

    // Limit results
    const limitedSlots = freeSlots.slice(0, maxResults);

    res.json({
      success: true,
      freeSlots: limitedSlots,
      totalFound: freeSlots.length,
      returned: limitedSlots.length
    });
  } catch (error) {
    console.error('❌ Find free time error:', error);
    res.status(500).json({
      error: 'Failed to find free time',
      message: error.message
    });
  }
});

// Create calendar event
router.post('/create-event', requireAuth, async (req, res) => {
  try {
    const { eventData, calendarId } = req.body;
    
    if (!eventData) {
      return res.status(400).json({
        error: 'Missing event data',
        message: 'eventData is required'
      });
    }

    const calendarService = new CalendarService(req.user.accessToken);
    const createdEvent = await calendarService.createEvent(eventData, calendarId);

    res.json({
      success: true,
      event: createdEvent
    });
  } catch (error) {
    console.error('❌ Create event error:', error);
    res.status(500).json({
      error: 'Failed to create event',
      message: error.message
    });
  }
});

// Get user's calendars
router.get('/calendars', requireAuth, async (req, res) => {
  try {
    const calendarService = new CalendarService(req.user.accessToken);
    const calendars = await calendarService.getCalendars();

    res.json({
      success: true,
      calendars: calendars
    });
  } catch (error) {
    console.error('❌ Get calendars error:', error);
    res.status(500).json({
      error: 'Failed to fetch calendars',
      message: error.message
    });
  }
});

module.exports = router;
