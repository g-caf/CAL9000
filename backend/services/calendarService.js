const { google } = require('googleapis');

class CalendarService {
  constructor(accessToken) {
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: accessToken });
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  // Get calendar events for a date range
  async getEvents(startDate, endDate, calendarId = 'primary') {
    try {
      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500
      });

      const events = response.data.items || [];
      console.log(`📅 Fetched ${events.length} events from ${startDate.toDateString()} to ${endDate.toDateString()}`);
      
      return this.processEvents(events);
    } catch (error) {
      console.error('❌ Error fetching calendar events:', error.message);
      throw new Error(`Calendar API error: ${error.message}`);
    }
  }

  // Process raw events into our format
  processEvents(rawEvents) {
    return rawEvents.map(event => {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      const isAllDay = !event.start?.dateTime;

      return {
        id: event.id,
        title: event.summary || 'Untitled Event',
        start: new Date(startTime),
        end: new Date(endTime),
        isAllDay: isAllDay,
        description: event.description || '',
        location: event.location || '',
        status: event.status,
        transparency: event.transparency,
        visibility: event.visibility,
        raw: event
      };
    }).filter(event => {
      // Filter out events we should ignore for conflict detection
      const duration = event.end.getTime() - event.start.getTime();
      const hoursLong = duration / (1000 * 60 * 60);
      
      // Skip all-day events and events longer than 8 hours
      if (event.isAllDay || hoursLong > 8) {
        console.log(`⏭️ Skipping event "${event.title}" (${event.isAllDay ? 'all-day' : hoursLong.toFixed(1) + 'h long'})`);
        return false;
      }

      // Skip transparent/free events
      if (event.transparency === 'transparent') {
        console.log(`⏭️ Skipping transparent event "${event.title}"`);
        return false;
      }

      return true;
    });
  }

  // Check for conflicts with a specific time slot
  checkConflicts(events, startTime, endTime) {
    const conflicts = events.filter(event => {
      return event.start < endTime && event.end > startTime;
    });

    if (conflicts.length === 0) {
      return { status: 'free', conflicts: [], percentage: 0 };
    }

    // Calculate conflict percentage
    const totalDuration = endTime.getTime() - startTime.getTime();
    let conflictDuration = 0;

    conflicts.forEach(conflict => {
      const overlapStart = Math.max(startTime.getTime(), conflict.start.getTime());
      const overlapEnd = Math.min(endTime.getTime(), conflict.end.getTime());
      conflictDuration += Math.max(0, overlapEnd - overlapStart);
    });

    const percentage = Math.round((conflictDuration / totalDuration) * 100);
    
    let status;
    if (percentage === 0) {
      status = 'free';
    } else if (percentage >= 100) {
      status = 'blocked';
    } else {
      status = 'partial';
    }

    return { status, conflicts, percentage };
  }

  // Create a new calendar event
  async createEvent(eventData, calendarId = 'primary') {
    try {
      const response = await this.calendar.events.insert({
        calendarId: calendarId,
        resource: eventData
      });

      console.log('✅ Created calendar event:', response.data.summary);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating calendar event:', error.message);
      throw new Error(`Failed to create event: ${error.message}`);
    }
  }

  // Get all user's calendars
  async getCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('❌ Error fetching calendars:', error.message);
      throw new Error(`Failed to fetch calendars: ${error.message}`);
    }
  }

  // Find free time slots
  async findFreeTime(startDate, endDate, durationMinutes, workingHours = { start: 9, end: 17 }) {
    try {
      const events = await this.getEvents(startDate, endDate);
      const freeSlots = [];
      
      // Generate potential time slots
      const current = new Date(startDate);
      while (current < endDate) {
        // Skip weekends
        if (current.getDay() === 0 || current.getDay() === 6) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        // Check working hours
        for (let hour = workingHours.start; hour < workingHours.end; hour++) {
          const slotStart = new Date(current);
          slotStart.setHours(hour, 0, 0, 0);
          
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

          // Don't go past working hours
          if (slotEnd.getHours() > workingHours.end) {
            break;
          }

          // Check for conflicts
          const conflictResult = this.checkConflicts(events, slotStart, slotEnd);
          if (conflictResult.status === 'free') {
            freeSlots.push({
              start: slotStart,
              end: slotEnd,
              duration: durationMinutes
            });
          }
        }

        current.setDate(current.getDate() + 1);
      }

      return freeSlots;
    } catch (error) {
      console.error('❌ Error finding free time:', error.message);
      throw new Error(`Failed to find free time: ${error.message}`);
    }
  }
}

module.exports = CalendarService;
