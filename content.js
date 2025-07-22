// State management
let isPopupOpen = false;
let circle = null;
let popup = null;

// Calendar events cache
let calendarEventsCache = {
  events: null,
  timestamp: null,
  weekDates: null
};

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Debounce timeout for timezone/duration changes
let debounceTimeout = null;

// Async processing cancellation
let currentAsyncOperation = null;
let limitedParsingTimeout = null;

// Timezone toggle state and data storage
let showingSourceTimezone = false;
let currentSourceTimezone = null;
let currentTargetTimezone = null;
let currentAvailabilitySegments = [];
let originalResultsHTML = null; // Store the original HTML to restore exactly

// Debounce utility function
function debounce(func, delay) {
  return function(...args) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Limited parsing that stops when user opens popup
function startLimitedParsing() {
  if (limitedParsingTimeout) return; // Already started
  
  console.log('🚀 Starting proximity pre-loading...');
  limitedParsingTimeout = true; // Mark as started
  
  // Start parsing
  getCachedCalendarData();
}

// Get calendar events using Google Calendar API
async function getCalendarEventsAsync(selectedDuration = null) {
  try {
    console.log('📅 Fetching calendar events via Google Calendar API...');
    
    if (!window.calendarAPI) {
      throw new Error('Calendar API not available');
    }

    // Get the date range for events (current week + buffer)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 14); // Two weeks
    endOfWeek.setHours(23, 59, 59, 999);

    console.log(`📅 Fetching events from ${startOfWeek.toLocaleDateString()} to ${endOfWeek.toLocaleDateString()}`);

    // Fetch events from the API
    const events = await window.calendarAPI.getEvents(startOfWeek, endOfWeek);
    
    console.log(`✅ API fetched ${events.length} relevant events`);
    
    // Convert to format expected by existing conflict detection code
    return events.map(event => ({
      title: event.title,
      start: event.start,
      end: event.end,
      isAllDay: event.isAllDay,
      element: null, // No DOM element since this is from API
      timeText: `${event.start.toLocaleTimeString()} - ${event.end.toLocaleTimeString()}`,
      raw: event
    }));
    
  } catch (error) {
    console.error('❌ Failed to fetch events via API, falling back to DOM parsing:', error);
    
    // Fallback to DOM parsing if API fails
    return getCalendarEventsDOMFallback(selectedDuration);
  }
}

// Fallback DOM parsing (simplified version of original)
async function getCalendarEventsDOMFallback(selectedDuration = null) {
  if (!isOnGoogleCalendar()) return [];
  
  console.log('🔄 Using DOM fallback for calendar events...');
  
  const events = [];
  const selectors = [
    '[data-eventchip]',
    '[data-eventid]', 
    '[jsname="XPtOyb"]',
    '[role="button"][aria-label*=":"]'
  ];
  
  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const eventData = extractEventData(element);
        if (eventData && !events.some(e => e.element === element)) {
          events.push(eventData);
        }
      });
    } catch (error) {
      console.warn(`DOM selector ${selector} failed:`, error);
    }
  });
  
  console.log(`📅 DOM fallback found ${events.length} events`);
  return events;
}

// Get cached calendar data or fetch fresh data
async function getCachedCalendarData(selectedDuration = null) {
  const now = Date.now();
  
  // Check if cache is valid
  if (calendarEventsCache.timestamp && 
      calendarEventsCache.events && 
      calendarEventsCache.weekDates &&
      (now - calendarEventsCache.timestamp < CACHE_DURATION)) {
    return {
      events: calendarEventsCache.events,
      weekDates: calendarEventsCache.weekDates
    };
  }
  
  // Fetch fresh data (async)
  const weekDates = getCurrentWeekDates(); // Keep this sync for now - less complex
  const events = await getCalendarEventsAsync(selectedDuration);
  
  // Update cache
  calendarEventsCache = {
    events: events,
    weekDates: weekDates,
    timestamp: now
  };
  
  return {
    events: events,
    weekDates: weekDates
  };
}

// Clear calendar cache (useful for manual refresh)
function clearCalendarCache() {
  calendarEventsCache = {
    events: null,
    timestamp: null,
    weekDates: null
  };
}

// Filter time segments to business hours (9AM-5PM) in target timezone
function filterToBusinessHours(timeSegment, selectedDuration = null) {
  // Parse the time segment format: "Day Month Date, StartTime – Day Month Date, EndTime" or "Day Month Date, StartTime – EndTime"
  const sameDayMatch = timeSegment.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(\d{1,2}:\d{2}[ap]m)$/);
  const multiDayMatch = timeSegment.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(.+?),\s*(\d{1,2}:\d{2}[ap]m)$/);
  
  let datePart, startTime, endTime;
  
  if (sameDayMatch) {
    [, datePart, startTime, endTime] = sameDayMatch;
  } else if (multiDayMatch) {
    [, datePart, startTime, , endTime] = multiDayMatch;
  } else {
    // Can't parse format, return as-is
    return timeSegment;
  }
  
  // Convert times to minutes for easier comparison
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const businessStart = 9 * 60; // 9:00am in minutes
  const businessEnd = 17 * 60;  // 5:00pm in minutes
  
  // Check for overlap with business hours
  const hasOverlap = startMinutes < businessEnd && endMinutes > businessStart;
  
  if (!hasOverlap) {
    // No overlap with business hours - hide segment
    return null;
  }
  
  // Trim to business hours boundaries
  const trimmedStart = Math.max(startMinutes, businessStart);
  const trimmedEnd = Math.min(endMinutes, businessEnd);
  
  // Check if trimmed segment is still valid (at least some duration)
  if (trimmedStart >= trimmedEnd) {
    return null;
  }
  
  // Convert back to time format
  const trimmedStartTime = minutesToTime(trimmedStart);
  const trimmedEndTime = minutesToTime(trimmedEnd);
  
  // Return trimmed segment
  const trimmedSegment = `${datePart}, ${trimmedStartTime} – ${trimmedEndTime}`;
  
  // Check if trimmed segment still meets duration requirement
  if (selectedDuration) {
    const segmentDuration = calculateSegmentDuration(trimmedSegment);
    if (segmentDuration < selectedDuration) {
      console.log(`❌ Business hours trimming created segment too short: "${trimmedSegment}" (${segmentDuration}min < ${selectedDuration}min required) - filtering out`);
      return null;
    }
  }
  
  return trimmedSegment;
}

// Convert time string to minutes since midnight
function timeToMinutes(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})(am|pm)/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toLowerCase();
  
  if (ampm === 'pm' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'am' && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
}

// Convert minutes since midnight to time string
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `${displayHours}:${displayMinutes}${ampm}`;
}

// Create emoji icon
function createClockIcon() {
  // Check if icon already exists to prevent duplicates
  if (document.getElementById('calendar-slack-indicator')) {
    return;
  }

  circle = document.createElement('div');
  circle.id = 'calendar-slack-indicator';
  circle.style.cssText = `
    position: fixed;
    top: 12px;
    right: 20px;
    width: 40px;
    height: 40px;
    z-index: 9999;
    cursor: pointer;
    font-size: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    backdrop-filter: blur(4px);
  `;

  // Start with baby angel emoji
  circle.textContent = '👼';

  // Add click event listener
  circle.addEventListener('click', togglePopup);
  
  // Wide-radius pre-loading with time limit (stored reference so we can remove it)
  const proximityHandler = (e) => {
    if (!isPopupOpen && !currentAsyncOperation && circle) {
      const iconRect = circle.getBoundingClientRect();
      const iconCenterX = iconRect.left + iconRect.width / 2;
      const iconCenterY = iconRect.top + iconRect.height / 2;
      
      // Calculate distance from icon center
      const distance = Math.sqrt(
        Math.pow(e.clientX - iconCenterX, 2) + 
        Math.pow(e.clientY - iconCenterY, 2)
      );
      
      // Start parsing when mouse within 200px of icon
      if (distance < 200) {
        console.log('🚀 Pre-loading on proximity...');
        startLimitedParsing();
      }
    }
  };
  
  document.addEventListener('mousemove', proximityHandler);
  
  // Store reference for cleanup
  circle._proximityHandler = proximityHandler;

  document.body.appendChild(circle);
}

// Helper function to convert availability segments between timezones
function convertSegmentsToTimezone(segments, fromTimezone, toTimezone) {
  return segments.map(segment => {
    // Parse the segment format: "Day Month Date, StartTime – EndTime" or "Day Month Date, StartTime – Day Month Date, EndTime"
    const sameDayMatch = segment.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(\d{1,2}:\d{2}[ap]m)(.*)$/);
    const multiDayMatch = segment.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(.+?),\s*(\d{1,2}:\d{2}[ap]m)(.*)$/);
    
    if (sameDayMatch) {
      const [, datePart, startTime, endTime, suffix] = sameDayMatch;
      const date = parseDate(datePart);
      
      if (date) {
        const convertedStart = convertTimeWithTimezone(startTime, date, fromTimezone, toTimezone);
        const convertedEnd = convertTimeWithTimezone(endTime, date, fromTimezone, toTimezone);
        return `${datePart}, ${convertedStart} – ${convertedEnd}${suffix}`;
      }
    } else if (multiDayMatch) {
      const [, startDatePart, startTime, endDatePart, endTime, suffix] = multiDayMatch;
      const startDate = parseDate(startDatePart);
      const endDate = parseDate(endDatePart);
      
      if (startDate && endDate) {
        const convertedStart = convertTimeWithTimezone(startTime, startDate, fromTimezone, toTimezone);
        const convertedEnd = convertTimeWithTimezone(endTime, endDate, fromTimezone, toTimezone);
        return `${startDatePart}, ${convertedStart} – ${endDatePart}, ${convertedEnd}${suffix}`;
      }
    }
    
    // If parsing fails, return original segment
    return segment;
  });
}

// Helper function to parse date from string like "Mon Dec 23"
function parseDate(dateStr) {
  try {
    const currentYear = new Date().getFullYear();
    const fullDateStr = `${dateStr} ${currentYear}`;
    const date = new Date(fullDateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

// Helper function to display converted results
function displayConvertedResults(resultsElement, segments, timezone, isSourceTimezone) {
  const timezoneName = getTimezoneDisplayName(timezone);
  const header = isSourceTimezone ? 
    `Available times for recruiter (${timezoneName}):\n\n` : 
    `Available times for your calendar (${timezoneName}):\n\n`;
  
  resultsElement.innerHTML = header + segments.join('\n');
}

// Helper function to get timezone display name
function getTimezoneDisplayName(timezone) {
  const names = {
    'America/New_York': 'EST',
    'America/Chicago': 'CST', 
    'America/Denver': 'MST',
    'America/Los_Angeles': 'PST',
    'UTC': 'UTC'
  };
  return names[timezone] || timezone;
}

// Helper function to convert availability segments between timezones
function convertSegmentsToTimezone(segments, fromTimezone, toTimezone) {
  return segments.map(segment => {
    // Parse the segment format: "Day Month Date, StartTime – EndTime" or "Day Month Date, StartTime – Day Month Date, EndTime"
    const sameDayMatch = segment.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(\d{1,2}:\d{2}[ap]m)(.*)$/);
    const multiDayMatch = segment.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(.+?),\s*(\d{1,2}:\d{2}[ap]m)(.*)$/);
    
    if (sameDayMatch) {
      const [, datePart, startTime, endTime, suffix] = sameDayMatch;
      const date = parseDate(datePart);
      
      if (date) {
        const convertedStart = convertTimeWithTimezone(startTime, date, fromTimezone, toTimezone);
        const convertedEnd = convertTimeWithTimezone(endTime, date, fromTimezone, toTimezone);
        return `${datePart}, ${convertedStart} – ${convertedEnd}${suffix}`;
      }
    } else if (multiDayMatch) {
      const [, startDatePart, startTime, endDatePart, endTime, suffix] = multiDayMatch;
      const startDate = parseDate(startDatePart);
      const endDate = parseDate(endDatePart);
      
      if (startDate && endDate) {
        const convertedStart = convertTimeWithTimezone(startTime, startDate, fromTimezone, toTimezone);
        const convertedEnd = convertTimeWithTimezone(endTime, endDate, fromTimezone, toTimezone);
        return `${startDatePart}, ${convertedStart} – ${endDatePart}, ${convertedEnd}${suffix}`;
      }
    }
    
    // If parsing fails, return original segment
    return segment;
  });
}

// Helper function to parse date from string like "Mon Dec 23"
function parseDate(dateStr) {
  try {
    const currentYear = new Date().getFullYear();
    const fullDateStr = `${dateStr} ${currentYear}`;
    const date = new Date(fullDateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

// Helper function to display converted results
function displayConvertedResults(resultsElement, segments, timezone, isSourceTimezone) {
  const timezoneName = getTimezoneDisplayName(timezone);
  const header = isSourceTimezone ? 
    `Available times for recruiter (${timezoneName}):\n\n` : 
    `Available times for your calendar (${timezoneName}):\n\n`;
  
  resultsElement.innerHTML = header + segments.join('\n');
}

// Helper function to get timezone display name
function getTimezoneDisplayName(timezone) {
  const names = {
    'America/New_York': 'EST',
    'America/Chicago': 'CST', 
    'America/Denver': 'MST',
    'America/Los_Angeles': 'PST',
    'UTC': 'UTC'
  };
  return names[timezone] || timezone;
}

// Helper function to redisplay results with same formatting as original
function redisplayResults(resultsElement, segments) {
  // Clear existing content
  resultsElement.innerHTML = '';
  
  // Recreate the exact same format as the original display
  segments.forEach(segment => {
    const lineElement = document.createElement('div');
    lineElement.textContent = segment;
    lineElement.style.padding = '2px 0'; // Default padding like original
    
    if (segment.startsWith('✅')) {
      // Available time - match original exactly: only set what original sets
      lineElement.style.backgroundColor = '#d4f8d4';
      lineElement.style.borderRadius = '3px';
      lineElement.style.padding = '4px 6px';
      lineElement.style.marginBottom = '2px';
    } else if (segment.startsWith('❌')) {
      // Unavailable time - if we ever need it
      lineElement.style.backgroundColor = '#f8d7da';
      lineElement.style.borderRadius = '3px';
      lineElement.style.padding = '4px 6px';
      lineElement.style.marginBottom = '2px';
    }
    // For other text (like timezone lines), just use default styling
    
    resultsElement.appendChild(lineElement);
  });
  
  resultsElement.style.color = '#333';
}

// Create popup element
function createPopup() {
  popup = document.createElement('div');
  popup.id = 'calendar-slack-popup';
  popup.style.cssText = `
    position: fixed;
    top: 45px;
    right: 20px;
    width: 355px;
    max-height: calc(100vh - 65px);
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    display: none;
    overflow-y: auto;
    box-sizing: border-box;
  `;

  // Create Google Calendar connection status/button
  const connectionContainer = document.createElement('div');
  connectionContainer.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding: 8px;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 12px;
  `;

  const connectionStatus = document.createElement('span');
  connectionStatus.textContent = 'Google Calendar: Not connected';
  connectionStatus.style.cssText = `
    color: #666;
    font-weight: 500;
  `;

  const connectButton = document.createElement('button');
  connectButton.textContent = 'Connect';
  connectButton.style.cssText = `
    padding: 4px 12px;
    border: 1px solid #4285f4;
    background: #4285f4;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
  `;

  // Add click handler for connect button
  connectButton.addEventListener('click', async () => {
    try {
      connectButton.textContent = 'Connecting...';
      connectButton.disabled = true;
      
      if (window.calendarAPI) {
        await window.calendarAPI.authenticate();
        connectionStatus.textContent = 'Google Calendar: Connected ✓';
        connectionStatus.style.color = '#28a745';
        connectButton.style.display = 'none';
        console.log('✅ Successfully connected to Google Calendar');
      } else {
        throw new Error('Calendar API not available');
      }
    } catch (error) {
      console.error('Failed to connect to Google Calendar:', error);
      connectionStatus.textContent = 'Google Calendar: Connection failed';
      connectionStatus.style.color = '#dc3545';
      connectButton.textContent = 'Retry';
      connectButton.disabled = false;
    }
  });

  connectionContainer.appendChild(connectionStatus);
  connectionContainer.appendChild(connectButton);

  // Create textarea
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Enter your message...';
  textarea.style.cssText = `
    width: 100%;
    height: 120px;
    border: 1px solid #ddd;
    padding: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    resize: vertical;
    box-sizing: border-box;
    border-radius: 4px;
  `;

  // Create duration selection buttons
  const durationContainer = document.createElement('div');
  durationContainer.style.cssText = `
    display: flex;
    gap: 8px;
    margin: 10px 0 8px 0;
    justify-content: center;
  `;

  const durations = [15, 30, 45, 60];
  let selectedDuration = null;
  const durationButtons = {}; // Cache button references
  
  // Helper function to get currently selected duration
  function getCurrentSelectedDuration() {
    const selectedBtn = durationContainer.querySelector('button.selected');
    const result = selectedBtn ? parseInt(selectedBtn.getAttribute('data-duration')) : null;
    console.log('🔍 getCurrentSelectedDuration:', {
      selectedBtn: selectedBtn,
      duration: result,
      allButtons: Array.from(durationContainer.querySelectorAll('button')).map(b => ({
        duration: b.getAttribute('data-duration'),
        hasSelected: b.classList.contains('selected'),
        background: b.style.background
      }))
    });
    return result;
  }

  // Helper function to get current buffer value
  function getCurrentBuffer() {
    const slider = popup.querySelector('#buffer-slider');
    return slider ? parseInt(slider.value) : 15; // Default to 15 if slider not found
  }

  durations.forEach(duration => {
    const button = document.createElement('button');
    button.textContent = `${duration}min`;
    button.style.cssText = `
      padding: 6px 12px;
      border: 1px solid #4285f4;
      background: white;
      color: #4285f4;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    `;
    
    const durationHandler = async () => {
      const timezoneDropdown = popup.querySelector('#timezone-dropdown');
      const currentDuration = getCurrentSelectedDuration();
      const currentBuffer = getCurrentBuffer();
      if (timezoneDropdown.value) {
        await handleTimezoneSelection(timezoneDropdown.value, textarea, resultsTextbox, currentDuration, currentBuffer);
      }
    };

    button.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Update selected duration
      selectedDuration = selectedDuration === duration ? null : duration;
      
      // Update button styles efficiently (no DOM queries)
      durations.forEach(d => {
        const btn = durationButtons[d]; // Use cached reference
        if (d === selectedDuration) {
          btn.style.background = '#4285f4';
          btn.style.color = 'white';
          btn.classList.add('selected');
        } else {
          btn.style.background = 'white';
          btn.style.color = '#4285f4';
          btn.classList.remove('selected');
        }
      });
      
      // Re-process results if timezone is already selected
      durationHandler();
    });
    
    button.setAttribute('data-duration', duration);
    durationButtons[duration] = button; // Cache the button reference
    durationContainer.appendChild(button);
  });

  // Create buffer slider and timezone toggle container
  const bufferContainer = document.createElement('div');
  bufferContainer.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 10px 0;
    gap: 8px;
    font-size: 12px;
    color: #666;
  `;

  // Left side: Buffer controls
  const bufferControls = document.createElement('div');
  bufferControls.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  const bufferLabel = document.createElement('span');
  bufferLabel.textContent = 'Buffer:';
  bufferLabel.style.cssText = `
    min-width: 40px;
    text-align: right;
  `;

  const bufferSlider = document.createElement('input');
  bufferSlider.type = 'range';
  bufferSlider.min = '0';
  bufferSlider.max = '15';
  bufferSlider.step = '5';
  bufferSlider.value = '15';
  bufferSlider.id = 'buffer-slider';
  bufferSlider.style.cssText = `
    width: 100px;
    height: 20px;
    margin: 0 5px;
  `;

  const bufferValue = document.createElement('span');
  bufferValue.textContent = '15min';
  bufferValue.id = 'buffer-value';
  bufferValue.style.cssText = `
    min-width: 35px;
    font-weight: 500;
    color: #333;
  `;

  // Right side: Timezone toggle button
  const timezoneToggle = document.createElement('button');
  timezoneToggle.textContent = 'Their Time';
  timezoneToggle.id = 'timezone-toggle';
  timezoneToggle.style.cssText = `
    padding: 4px 8px;
    border: 1px solid #4285f4;
    background: white;
    color: #4285f4;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
    display: block;
    width: 70px;
    text-align: center;
    opacity: 0.5;
    cursor: not-allowed;
  `;

  // Update buffer value display when slider moves
  bufferSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    bufferValue.textContent = `${value}min`;
  });

  // Re-process results when buffer changes (debounced)
  bufferSlider.addEventListener('change', debounce(async () => {
    const timezoneDropdown = popup.querySelector('#timezone-dropdown');
    const currentDuration = getCurrentSelectedDuration();
    const currentBuffer = getCurrentBuffer();
    
    if (timezoneDropdown.value) {
      console.log(`🔄 Buffer changed to ${currentBuffer}min - re-processing results`);
      await handleTimezoneSelection(timezoneDropdown.value, textarea, resultsTextbox, currentDuration, currentBuffer);
    }
  }, 500));

  // Toggle button click handler
  timezoneToggle.addEventListener('click', async () => {
    // Only allow clicking if toggle is enabled
    if (timezoneToggle.style.opacity === '0.5') return;
    
    showingSourceTimezone = !showingSourceTimezone;
    
    if (showingSourceTimezone) {
      // Convert to source timezone for recruiter
      timezoneToggle.textContent = 'My Time';
      timezoneToggle.style.background = '#4285f4';
      timezoneToggle.style.color = 'white';
      
      // Convert segments back to source timezone and redisplay with same formatting
      const convertedSegments = convertSegmentsToTimezone(currentAvailabilitySegments, currentTargetTimezone, currentSourceTimezone);
      redisplayResults(resultsTextbox, convertedSegments);
    } else {
      // Show in target timezone for your calendar - restore original HTML exactly
      timezoneToggle.textContent = 'Their Time';
      timezoneToggle.style.background = 'white';
      timezoneToggle.style.color = '#4285f4';
      
      // Restore the exact original HTML (preserves all formatting, colors, etc.)
      if (originalResultsHTML) {
        resultsTextbox.innerHTML = originalResultsHTML;
      }
    }
  });

  // Assemble buffer controls
  bufferControls.appendChild(bufferLabel);
  bufferControls.appendChild(bufferSlider);
  bufferControls.appendChild(bufferValue);

  // Assemble main container
  bufferContainer.appendChild(bufferControls);
  bufferContainer.appendChild(timezoneToggle);

  // Create timezone selection dropdown
  const timezoneDropdown = document.createElement('select');
  timezoneDropdown.id = 'timezone-dropdown';
  timezoneDropdown.style.cssText = `
    width: 100%;
    height: 40px;
    margin-bottom: 10px;
    box-sizing: border-box;
    font-size: 14px;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
  `;

  // Add dropdown options
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select timezone to convert times...';
  timezoneDropdown.appendChild(defaultOption);

  const timezones = [
    // Major US timezones
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PST)' },
    { value: 'UTC', label: 'UTC' },
    
    // Other Americas
    { value: 'America/Toronto', label: 'Toronto' },
    { value: 'America/Vancouver', label: 'Vancouver' },
    { value: 'America/Mexico_City', label: 'Mexico City' },
    { value: 'America/Sao_Paulo', label: 'São Paulo' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
    
    // Europe
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Europe/Berlin', label: 'Berlin' },
    { value: 'Europe/Rome', label: 'Rome' },
    { value: 'Europe/Madrid', label: 'Madrid' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam' },
    { value: 'Europe/Stockholm', label: 'Stockholm' },
    { value: 'Europe/Moscow', label: 'Moscow' },
    
    // Asia
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
    { value: 'Asia/Singapore', label: 'Singapore' },
    { value: 'Asia/Seoul', label: 'Seoul' },
    { value: 'Asia/Mumbai', label: 'Mumbai' },
    { value: 'Asia/Dubai', label: 'Dubai' },
    { value: 'Asia/Bangkok', label: 'Bangkok' },
    
    // Australia & Pacific
    { value: 'Australia/Sydney', label: 'Sydney' },
    { value: 'Australia/Melbourne', label: 'Melbourne' },
    { value: 'Australia/Perth', label: 'Perth' },
    { value: 'Pacific/Auckland', label: 'Auckland' },
    
    // Africa
    { value: 'Africa/Cairo', label: 'Cairo' },
    { value: 'Africa/Lagos', label: 'Lagos' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg' },
    { value: 'Africa/Casablanca', label: 'Casablanca' }
  ];
  
  timezones.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz.value;
    option.textContent = tz.label;
    timezoneDropdown.appendChild(option);
  });

  // Create results display area (initially hidden) - div for color coding
  const resultsTextbox = document.createElement('div');
  resultsTextbox.id = 'results-textbox';
  resultsTextbox.style.cssText = `
    width: 100%;
    min-height: 80px;
    max-height: 400px;
    border: 1px solid #ddd;
    background: white;
    padding: 8px 8px 13px 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 11px;
    margin-top: 10px;
    box-sizing: border-box;
    display: none;
    overflow-y: auto;
    overflow-x: hidden;
    white-space: pre-line;
    border-radius: 4px;
  `;

  // Add immediate dropdown change event handler
  timezoneDropdown.addEventListener('change', async (event) => {
    const selectedDuration = getCurrentSelectedDuration();
    const currentBuffer = getCurrentBuffer();
    const targetTimezone = event.target.value;
    
    if (targetTimezone) {
      await handleTimezoneSelection(targetTimezone, textarea, resultsTextbox, selectedDuration, currentBuffer);
    } else {
      resultsTextbox.style.display = 'none';
    }
  });

  popup.appendChild(connectionContainer);
  popup.appendChild(textarea);
  popup.appendChild(bufferContainer);
  popup.appendChild(durationContainer);
  popup.appendChild(timezoneDropdown);
  popup.appendChild(resultsTextbox);
  document.body.appendChild(popup);

  return { textarea, timezoneDropdown, resultsTextbox };
}

// Close popup function (extracted for reuse)
function closePopup() {
  if (!isPopupOpen || !popup) return;
  
  // Close popup
  popup.style.display = 'none';
  
  // Clear inputs and outputs
  const textarea = popup.querySelector('textarea');
  const timezoneDropdown = popup.querySelector('#timezone-dropdown');
  const resultsTextbox = popup.querySelector('#results-textbox');
  
  if (textarea) {
    textarea.value = '';
  }
  if (timezoneDropdown) {
    timezoneDropdown.value = '';
  }
  if (resultsTextbox) {
    resultsTextbox.style.display = 'none';
    resultsTextbox.innerHTML = '';
  }
  
  // Reset duration button selections
  const durationButtons = popup.querySelectorAll('button[data-duration]');
  durationButtons.forEach(btn => {
    btn.style.background = 'white';
    btn.style.color = '#4285f4';
    btn.classList.remove('selected');
  });
  
  // Reset buffer slider to default (15 minutes)
  const bufferSlider = popup.querySelector('#buffer-slider');
  const bufferValue = popup.querySelector('#buffer-value');
  if (bufferSlider) {
    bufferSlider.value = '15';
  }
  if (bufferValue) {
    bufferValue.textContent = '15min';
  }
  
  // Reset timezone toggle button to disabled state
  const timezoneToggle = popup.querySelector('#timezone-toggle');
  if (timezoneToggle) {
    timezoneToggle.textContent = 'Their Time';
    timezoneToggle.style.background = 'white';
    timezoneToggle.style.color = '#4285f4';
    timezoneToggle.style.opacity = '0.5';
    timezoneToggle.style.cursor = 'not-allowed';
  }
  
  // Reset timezone toggle state
  showingSourceTimezone = false;
  currentSourceTimezone = null;
  currentTargetTimezone = null;
  currentAvailabilitySegments = [];
  
  // Restore icon to baby angel when popup closes
  if (circle) {
    circle.textContent = '👼';
  }
  
  // Re-enable proximity detection
  if (circle && circle._proximityHandler) {
    document.addEventListener('mousemove', circle._proximityHandler);
    console.log('✅ Re-enabled proximity detection');
  }
  
  // Remove click-outside listener
  document.removeEventListener('click', handleClickOutside);
  
  isPopupOpen = false;
}

// Simple health check function
async function checkExtensionHealth() {
  if (!isOnGoogleCalendar()) return true;
  
  try {
    // Quick test: can we find enough events (same threshold as tiered parsing)
    const events = await getCalendarEventsAsync();
    
    // If we're on calendar but find fewer than 15 events, likely a selector issue
    const isHealthy = events.length >= 15;
    
    if (!isHealthy) {
      console.warn(`🏥 Health check failed - only ${events.length} events detected (expected 15+), selectors may need updating`);
    }
    
    return isHealthy;
  } catch (error) {
    console.warn('🏥 Health check error:', error);
    return false;
  }
}

// Open popup function (extracted for reuse)
async function openPopup() {
  if (isPopupOpen) return;
  
  if (!popup) {
    createPopup();
  }
  
  // Open popup
  popup.style.display = 'block';
  
  // Disable proximity detection while popup is open (prevents UI interference)
  if (circle && circle._proximityHandler) {
    document.removeEventListener('mousemove', circle._proximityHandler);
    console.log('🛑 Disabled proximity detection while popup is open');
  }
  
  // Set initial icon to robotic arm
  if (circle) {
    circle.textContent = '🦾';
  }
  
  // Add click-outside listener after a small delay to prevent immediate closing
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 100);
  
  isPopupOpen = true;
  
  // Focus textarea
  const textarea = popup.querySelector('textarea');
  if (textarea) {
    textarea.focus();
  }
  
  // Run health check and update icon if needed
  setTimeout(async () => {
    const isHealthy = await checkExtensionHealth();
    if (!isHealthy && circle && isPopupOpen) {
      circle.textContent = '⚠️';
    }
  }, 2000); // Check after calendar parsing has had time to complete
}

// Handle clicks outside the popup to close it
function handleClickOutside(event) {
  if (!isPopupOpen || !popup) return;
  
  // Check if click is outside both the popup and the clock icon
  const isClickInsidePopup = popup.contains(event.target);
  const isClickOnIcon = circle && circle.contains(event.target);
  
  if (!isClickInsidePopup && !isClickOnIcon) {
    closePopup();
  }
}

// Toggle popup open/close
function togglePopup(event) {
  event.stopPropagation();
  
  if (isPopupOpen) {
    closePopup();
  } else {
    openPopup();
  }
}

// Extract recipient name from greeting
function extractRecipientName(text) {
  const greetingPattern = /^Hi\s+([A-Za-z]+)/m;
  const match = text.match(greetingPattern);
  return match ? match[1] : null;
}

// Extract timezone assignments from text
function extractTimezoneAssignments(text) {
  const assignments = {};
  
  // Look for all patterns like "Name's candidates: TZ" anywhere in the text
  const nameTimezonePattern = /([A-Za-z]+)'s\s+candidates:\s*([A-Z]{2,3})/g;
  let match;
  
  while ((match = nameTimezonePattern.exec(text)) !== null) {
    const [fullMatch, name, timezone] = match;
    assignments[name.toLowerCase()] = timezone;
  }
  
  return assignments;
}

// Determine timezone based on required names in text
function determineTimezone(text) {
  if (!text) {
    console.log('🌍 No text provided to determineTimezone');
    return null; // No default behavior
  }
  
  const textLower = text.toLowerCase();
  
  // First, check for explicit timezone mentions (these take precedence)
  const timezonePatterns = [
    { pattern: /\b(pst|pt|pacific)\b/i, timezone: 'America/Los_Angeles', name: 'PST' },
    { pattern: /\b(est|et|eastern)\b/i, timezone: 'America/New_York', name: 'EST' },
    { pattern: /\b(cst|ct|central)\b/i, timezone: 'America/Chicago', name: 'CST' },
    { pattern: /\b(mst|mt|mountain)\b/i, timezone: 'America/Denver', name: 'MST' },
    { pattern: /\butc\b/i, timezone: 'UTC', name: 'UTC' }
  ];
  
  for (const { pattern, timezone, name } of timezonePatterns) {
    if (pattern.test(text)) {
      return timezone;
    }
  }
  
  // If no explicit timezone found, fall back to name-based detection
  if (textLower.includes('kelsey')) {
    return 'America/Chicago'; // CT
  } else if (textLower.includes('devon')) {
    return 'America/New_York'; // ET
  } else if (textLower.includes('trevor')) {
    return 'America/Los_Angeles'; // PT
  }
  return null; // No valid name found
}

// Extract date/time availability information from text
function extractAvailability(text) {
  if (!text || text.trim() === '') {
    return { success: false, error: 'Please enter some text to process' };
  }

  // Determine timezone from required names in text
  const timezone = determineTimezone(text);
  
  // Check if required name was found
  if (!timezone) {
    return { success: false, error: 'Please include Kelsey, Trevor, or Devon in the text to determine source timezone' };
  }

  // Regex pattern to match date/time availability
  // Matches two formats:
  // 1. "Day Month Date, StartTime – Day Month Date, EndTime" (multi-day)
  // 2. "Day Month Date, StartTime – EndTime" (same day)
  const multiDayPattern = /([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{1,2}:\d{2}[ap]m)/g;
  const sameDayPattern = /([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(\d{1,2}:\d{2}[ap]m)/g;
  
  const matches = [];
  let match;
  
  // First try multi-day pattern
  while ((match = multiDayPattern.exec(text)) !== null) {
    const [fullMatch, startDay, startMonth, startDate, startTime, endDay, endMonth, endDate, endTime] = match;
    // Format: "StartDay StartMonth StartDate, StartTime – EndDay EndMonth EndDate, EndTime"
    matches.push(`${startDay} ${startMonth} ${startDate}, ${startTime} – ${endDay} ${endMonth} ${endDate}, ${endTime}`);
  }
  
  // Reset regex lastIndex for second pattern
  sameDayPattern.lastIndex = 0;
  
  // Then try same-day pattern
  while ((match = sameDayPattern.exec(text)) !== null) {
    const [fullMatch, day, month, date, startTime, endTime] = match;
    // Check if this match was already captured by multi-day pattern
    const candidateMatch = `${day} ${month} ${date}, ${startTime} – ${endTime}`;
    const alreadyMatched = matches.some(existing => 
      existing.includes(`${day} ${month} ${date}, ${startTime}`)
    );
    
    if (!alreadyMatched) {
      matches.push(candidateMatch);
    }
  }

  if (matches.length === 0) {
    return { success: false, error: 'No availability information found in the text' };
  }

  // Don't add timezone to results - it's already shown in the dropdown selection

  return { success: true, results: matches };
}

// Convert time from source timezone to target timezone using native JS
function convertTimeWithTimezone(timeStr, date, sourceTimezone, targetTimezone) {
  const time = parseTime(timeStr);
  if (!time) return timeStr;
  
  // If same timezone, no conversion needed
  if (sourceTimezone === targetTimezone) {
    return timeStr;
  }
  
  try {
    // Create a date string that represents the time in the source timezone
    // Use the actual date from input to handle DST correctly
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = time.hours.toString().padStart(2, '0');
    const minutes = time.minutes.toString().padStart(2, '0');
    
    // Create a date string in ISO format but treat it as if it's in the source timezone
    const dateString = `${year}-${month}-${day}T${hours}:${minutes}:00`;
    
    // Use a trick: create the date assuming it's in the source timezone
    // by using the timezone offset difference
    const sourceDate = new Date(dateString);
    
    // Get timezone offsets (this is approximate and doesn't handle DST perfectly)
    const timezoneOffsets = {
      'America/New_York': -5, // EST (winter) / -4 (EDT summer)
      'America/Chicago': -6,  // CST (winter) / -5 (CDT summer) 
      'America/Denver': -7,   // MST (winter) / -6 (MDT summer)
      'America/Los_Angeles': -8, // PST (winter) / -7 (PDT summer)
      'UTC': 0
    };
    
    const sourceOffset = timezoneOffsets[sourceTimezone] || 0;
    const targetOffset = timezoneOffsets[targetTimezone] || 0;
    const offsetDiff = targetOffset - sourceOffset; // Hours to add
    
    // Apply the offset
    const convertedDate = new Date(sourceDate);
    convertedDate.setHours(convertedDate.getHours() + offsetDiff);
    
    // Format the result
    const resultHour = convertedDate.getHours();
    const resultMinute = convertedDate.getMinutes();
    const ampm = resultHour >= 12 ? 'pm' : 'am';
    const displayHour = resultHour === 0 ? 12 : (resultHour > 12 ? resultHour - 12 : resultHour);
    const displayMinute = resultMinute.toString().padStart(2, '0');
    
    const result = `${displayHour}:${displayMinute}${ampm}`;
    return result;
  } catch (error) {
    return timeStr;
  }
}

// Parse time string and convert to 24-hour format
function parseTime(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})(am|pm)/i);
  if (!match) return null;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toLowerCase();
  
  if (ampm === 'pm' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'am' && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
}

// Format time back to 12-hour format
function formatTime(hours, minutes) {
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes}${ampm}`;
}

// Extract date from line for timezone conversion
function extractDateFromLine(line) {
  console.log(`Extracting date from line: "${line}"`);
  
  // Try multiple date formats
  // Format 1: "Day Month Date" (original)
  let match = line.match(/([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2})/);
  if (match) {
    const [, dayName, month, date] = match;
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const currentYear = new Date().getFullYear();
    const result = new Date(currentYear, monthMap[month], parseInt(date));
    console.log(`Extracted date (format 1):`, result);
    return result;
  }
  
  // Format 2: "Month Date" (like "Jun 24")
  match = line.match(/([A-Za-z]{3})\s+(\d{1,2})/);
  if (match) {
    const [, month, date] = match;
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const currentYear = new Date().getFullYear();
    const result = new Date(currentYear, monthMap[month], parseInt(date));
    console.log(`Extracted date (format 2):`, result);
    return result;
  }
  
  // Format 3: Just date number (assume current month)
  match = line.match(/\b(\d{1,2})\b/);
  if (match) {
    const date = parseInt(match[1]);
    if (date >= 1 && date <= 31) {
      const now = new Date();
      const result = new Date(now.getFullYear(), now.getMonth(), date);
      console.log(`Extracted date (format 3):`, result);
      return result;
    }
  }
  
  console.log('No valid date found, returning current date');
  return new Date();
}

// Convert availability line to target timezone
function convertAvailabilityLine(line, sourceTimezone, targetTimezone) {
  // Skip empty lines and timezone lines
  if (!line.trim() || line.startsWith('Timezone:')) {
    return line;
  }
  
  // Parse the line format: "Day Month Date, StartTime – EndTime"
  const match = line.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(.+?),\s*(\d{1,2}:\d{2}[ap]m)$/);
  if (!match) {
    // Try same-day format: "Day Month Date, StartTime – EndTime"
    const sameDayMatch = line.match(/^(.+?),\s*(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(\d{1,2}:\d{2}[ap]m)$/);
    if (sameDayMatch) {
      const [fullMatch, datePart, startTime, endTime] = sameDayMatch;
      const date = extractDateFromLine(datePart);
      const convertedStart = convertTimeWithTimezone(startTime, date, sourceTimezone, targetTimezone);
      const convertedEnd = convertTimeWithTimezone(endTime, date, sourceTimezone, targetTimezone);
      return `${datePart}, ${convertedStart} – ${convertedEnd}`;
    }
    return line;
  }
  
  const [fullMatch, startDatePart, startTime, endDatePart, endTime] = match;
  const startDate = extractDateFromLine(startDatePart);
  const endDate = extractDateFromLine(endDatePart);
  const convertedStart = convertTimeWithTimezone(startTime, startDate, sourceTimezone, targetTimezone);
  const convertedEnd = convertTimeWithTimezone(endTime, endDate, sourceTimezone, targetTimezone);
  
  return `${startDatePart}, ${convertedStart} – ${endDatePart}, ${convertedEnd}`;
}

// Show loading indicator in results textbox
function showLoadingIndicator(resultsTextbox) {
  resultsTextbox.style.display = 'block';
  resultsTextbox.innerHTML = `
    <div style="
      display: flex; 
      align-items: center; 
      justify-content: center; 
      padding: 20px; 
      color: #666;
      font-size: 12px;
    ">
      <div style="
        width: 16px; 
        height: 16px; 
        border: 2px solid #f3f3f3; 
        border-top: 2px solid #4285f4; 
        border-radius: 50%; 
        animation: spin 1s linear infinite;
        margin-right: 8px;
      "></div>
      Yeah?
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
}

// Handle timezone selection (extract and convert)
async function handleTimezoneSelection(targetTimezone, textarea, resultsTextbox, selectedDuration = null, bufferMinutes = 15) {
  console.log('🌍 handleTimezoneSelection called with:', { targetTimezone, selectedDuration, bufferMinutes });
  
  // Cancel any previous async operations and proximity preloading
  if (currentAsyncOperation) {
    console.log('🛑 Cancelling previous operation');
    currentAsyncOperation = null;
  }
  
  // Reset proximity preloading flag
  if (limitedParsingTimeout) {
    console.log('🛑 Stopping proximity pre-loading - popup opened');
    limitedParsingTimeout = null;
  }
  
  const text = textarea.value;
  
  // Show loading indicator
  showLoadingIndicator(resultsTextbox);
  
  const extraction = extractAvailability(text);
  
  if (extraction.success) {
    // Get the original timezone from extraction results
    const originalResults = extraction.results.join('\n');
    const lines = originalResults.split('\n');
    
    // Get the source timezone by re-detecting from the original text
    let sourceTimezone = determineTimezone(text);
    
    // Fallback: check for explicit timezone line in results (legacy support)
    if (!sourceTimezone) {
      const timezoneLine = lines.find(line => line.startsWith('Timezone:'));
      if (timezoneLine) {
        const timezoneAbbr = timezoneLine.replace('Timezone:', '').trim();
        
        // Map abbreviations back to IANA format
        const abbrToIANA = {
          'CST': 'America/Chicago',
          'EST': 'America/New_York', 
          'PST': 'America/Los_Angeles',
          'MST': 'America/Denver',
          'UTC': 'UTC'
        };
        
        sourceTimezone = abbrToIANA[timezoneAbbr] || timezoneAbbr;
        console.log(`🌍 Source timezone from legacy line: "${timezoneAbbr}" -> "${sourceTimezone}"`);
      } else {
        // Final fallback only if no name detected
        sourceTimezone = 'America/Los_Angeles';
        console.log(`🌍 Using final fallback timezone: ${sourceTimezone}`);
      }
    }
    
    // Convert all availability lines to target timezone
    const convertedLines = lines.map(line => {
      if (line.startsWith('Timezone:')) {
        // Map target timezone to abbreviation
        const timezoneAbbreviations = {
          'America/Chicago': 'CST',
          'America/New_York': 'EST', 
          'America/Los_Angeles': 'PST',
          'UTC': 'UTC'
        };
        const timezoneLabel = timezoneAbbreviations[targetTimezone] || targetTimezone.split('/').pop().replace('_', ' ');
        return `Timezone: ${timezoneLabel}`;
      }
      return convertAvailabilityLine(line, sourceTimezone, targetTimezone);
    });
    
    // Calendar integration (if on Google Calendar)
    if (isOnGoogleCalendar()) {
      await displayResultsWithCalendarIntegration(convertedLines, targetTimezone, resultsTextbox, selectedDuration, bufferMinutes);
    } else {
      // Display converted results without calendar integration
      resultsTextbox.innerHTML = '';
      convertedLines.forEach(line => {
        const lineElement = document.createElement('div');
        lineElement.textContent = line;
        lineElement.style.padding = '2px 0';
        resultsTextbox.appendChild(lineElement);
      });
      resultsTextbox.style.color = '#333';
    }
    
    // Store data for timezone toggle functionality
    const timezoneToggle = popup.querySelector('#timezone-toggle');
    console.log('🔍 Debug toggle:', { 
      timezoneToggle: !!timezoneToggle, 
      sourceTimezone, 
      targetTimezone, 
      different: sourceTimezone !== targetTimezone 
    });
    
    if (timezoneToggle) {
      // Store the timezone and availability data globally
      currentSourceTimezone = sourceTimezone;
      currentTargetTimezone = targetTimezone;
      
      // Store the original HTML and text segments for toggle functionality
      setTimeout(() => {
        // Store the complete original HTML to restore exactly as-is
        originalResultsHTML = resultsTextbox.innerHTML;
        
        // Also store text segments for conversion
        const displayedElements = resultsTextbox.querySelectorAll('div');
        currentAvailabilitySegments = Array.from(displayedElements).map(el => el.textContent).filter(text => text.trim() && !text.startsWith('Timezone:'));
        
        console.log('💾 Stored original HTML and segments for toggle');
      }, 100);
      
      if (sourceTimezone !== targetTimezone) {
        // Enable the toggle button when different timezones are available
        timezoneToggle.style.opacity = '1';
        timezoneToggle.style.cursor = 'pointer';
        timezoneToggle.textContent = 'Their Time';
        timezoneToggle.style.background = 'white';
        timezoneToggle.style.color = '#4285f4';
        
        console.log('✅ Toggle button enabled for timezone conversion');
      } else {
        // Keep disabled for same timezone
        timezoneToggle.style.opacity = '0.5';
        timezoneToggle.style.cursor = 'not-allowed';
        timezoneToggle.textContent = 'Same TZ';
        
        console.log('⚠️ Toggle button disabled - same timezone');
      }
      
      // Reset toggle state
      showingSourceTimezone = false;
    } else {
      console.log('❌ Toggle button not found in DOM');
    }
    
    // Auto-size the results textbox based on content
    autoSizeResultsTextbox(resultsTextbox);
  } else {
    // Display error message
    resultsTextbox.textContent = extraction.error;
    resultsTextbox.style.color = '#d73a49';
    
    // Auto-size the results textbox based on content
    autoSizeResultsTextbox(resultsTextbox);
  }
}

// Auto-size the results textbox based on content
function autoSizeResultsTextbox(resultsTextbox) {
  // Create a temporary element to measure content height
  const temp = document.createElement('div');
  temp.style.cssText = `
    position: absolute;
    visibility: hidden;
    height: auto;
    width: ${resultsTextbox.offsetWidth}px;
    padding: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: normal;
    white-space: pre-line;
    box-sizing: border-box;
  `;
  
  // Copy content to temp element
  temp.innerHTML = resultsTextbox.innerHTML;
  document.body.appendChild(temp);
  
  // Measure the natural height
  const naturalHeight = temp.scrollHeight;
  document.body.removeChild(temp);
  
  // Set height with min/max constraints
  const minHeight = 80;
  const maxHeight = 300;
  const targetHeight = Math.max(minHeight, Math.min(maxHeight, naturalHeight));
  
  resultsTextbox.style.height = `${targetHeight}px`;
  
  // Only show scrollbar if content exceeds max height
  if (naturalHeight > maxHeight) {
    resultsTextbox.style.overflowY = 'auto';
  } else {
    resultsTextbox.style.overflowY = 'hidden';
  }
}

// Calculate duration of a time segment in minutes
function calculateSegmentDuration(timeSlot) {
  // Handle both formats: "9:00am – 10:30am" and "Thu Jul 3, 9:00am – Thu Jul 3, 10:30am"
  const timeMatch = timeSlot.match(/.*?(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*.*?(\d{1,2}:\d{2}[ap]m)/);
  if (!timeMatch) {
    console.log(`⚠️ Duration calc: No time match for "${timeSlot}"`);
    return 0;
  }
  
  const [, startTime, endTime] = timeMatch;
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const duration = endMinutes - startMinutes;
  
  console.log(`⏱️ Duration calc: "${startTime}" (${startMinutes}min) to "${endTime}" (${endMinutes}min) = ${duration} minutes`);
  return duration;
}

// Display results with calendar integration and color coding
async function displayResultsWithCalendarIntegration(convertedLines, targetTimezone, resultsTextbox, selectedDuration = null, bufferMinutes = 15) {
  let calendarIntegrationWorking = false;
  let warningMessage = '';
  
  try {
    // Get cached calendar data
    const { events: calendarEvents, weekDates: calendarWeekDates } = await getCachedCalendarData(selectedDuration);
    
    // Debug logging for calendar integration
    console.log('Calendar integration debug:', {
      weekDates: calendarWeekDates,
      eventsFound: calendarEvents.length,
      events: calendarEvents
    });
    
    // Check if calendar integration is working
    console.log('Calendar integration check:');
    console.log('- Week dates found:', calendarWeekDates?.length || 0);
    console.log('- Calendar events found:', calendarEvents.length);
    console.log('- Sample events:', calendarEvents.slice(0, 3).map(e => e.text?.substring(0, 30)));
    
    if (!calendarWeekDates || calendarWeekDates.length === 0) {
      warningMessage = 'Week detection failed - using default colors';
      console.log('❌ Calendar integration DISABLED: No week dates');
    } else if (calendarEvents.length === 0) {
      warningMessage = 'Event detection failed - colors may not reflect actual conflicts';
      console.log('❌ Calendar integration DISABLED: No events');
    } else {
      calendarIntegrationWorking = true;
      console.log('✅ Calendar integration ENABLED');
    }
    
    // Extract dates from availability lines for validation
    const extractedDates = [];
    const availabilityLines = convertedLines.filter(line => 
      !line.startsWith('Timezone:') && line.trim() !== ''
    );
    
    availabilityLines.forEach(line => {
      const date = extractDateFromLine(line);
      if (date) extractedDates.push(date);
    });
    
    // Validate dates are in current calendar week (only if week detection worked)
    if (calendarWeekDates && calendarWeekDates.length > 0 && extractedDates.length > 0) {
      const validation = validateDatesInCurrentWeek(extractedDates, calendarWeekDates);
      if (!validation.valid) {
        resultsTextbox.textContent = validation.error;
        resultsTextbox.style.color = '#d73a49';
        return;
      }
      
      // Show overflow warning if dates extend beyond current week
      if (validation.allowOverflow) {
        console.log('Date overflow detected - some dates extend beyond current week but proceeding');
      }
    }
    
    // Build HTML with color coding based on conflicts
    resultsTextbox.innerHTML = '';
    
    // Add warning message if calendar integration isn't working
    if (warningMessage) {
      const warningElement = document.createElement('div');
      warningElement.textContent = `⚠️ ${warningMessage}`;
      warningElement.style.cssText = `
        color: #856404;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        padding: 4px 6px;
        border-radius: 3px;
        margin-bottom: 8px;
        font-size: 11px;
      `;
      resultsTextbox.appendChild(warningElement);
    }
    
    // Add overflow info if dates extend beyond current week
    if (calendarWeekDates && calendarWeekDates.length > 0 && extractedDates.length > 0) {
      const validation = validateDatesInCurrentWeek(extractedDates, calendarWeekDates);
      if (validation.valid && validation.allowOverflow) {
        const infoElement = document.createElement('div');
        infoElement.textContent = `ℹ️ Some dates extend beyond current week - showing all requested times`;
        infoElement.style.cssText = `
          color: #0c5460;
          background: #d1ecf1;
          border: 1px solid #bee5eb;
          padding: 4px 6px;
          border-radius: 3px;
          margin-bottom: 8px;
          font-size: 11px;
        `;
        resultsTextbox.appendChild(infoElement);
      }
    }
    
    // Process each line to show available segments
    const processedLines = [];
    
    convertedLines.forEach(line => {
      if (line.trim() === '' || line.startsWith('Timezone:')) {
        // Keep empty lines and timezone lines as-is
        processedLines.push({ line, isTimezone: line.startsWith('Timezone:') });
      } else {
        // This is an availability line - calculate available segments
        if (calendarIntegrationWorking) {
          const availableSegments = calculateAvailableSegments(line, calendarEvents, targetTimezone, selectedDuration, bufferMinutes);
          
          if (availableSegments.length === 0 || !availableSegments[0].available) {
            // No availability - skip this line (don't show unavailable segments)
            console.log(`❌ No available segments for: "${line}" - hiding from display`);
          } else {
            // Show all available segments (duration filtering already handled in calculateAvailableSegments)
            availableSegments.forEach(segment => {
              // Apply business hours filter to the converted time segment
              const businessHoursSegment = filterToBusinessHours(segment.timeSlot, selectedDuration);
              if (businessHoursSegment) {
                processedLines.push({ line: '✅ ' + businessHoursSegment, available: true });
              }
            });
          }
        } else {
          // Fallback when calendar integration isn't working
          processedLines.push({ line: '✅ ' + line, available: true });
        }
      }
    });
    
    // Display all processed lines
    console.log(`🖥️ Displaying ${processedLines.length} processed lines:`, processedLines);
    
    processedLines.forEach(({ line, isTimezone, available }, index) => {
      console.log(`  Line ${index}: "${line}" (timezone: ${isTimezone}, available: ${available})`);
      
      const lineElement = document.createElement('div');
      lineElement.textContent = line;
      lineElement.style.padding = '2px 0';
      
      if (line.trim() === '') {
        // Empty line
        lineElement.innerHTML = '&nbsp;';
      } else if (isTimezone) {
        // Timezone line - no color coding
        lineElement.style.fontWeight = 'bold';
      } else {
        // Availability line - color based on availability
        const backgroundColor = available === false ? '#f8d7da' : '#d4f8d4'; // Red for no availability, green for available
        
        lineElement.style.backgroundColor = backgroundColor;
        lineElement.style.borderRadius = '3px';
        lineElement.style.padding = '4px 6px';
        lineElement.style.marginBottom = '2px';
      }
      
      resultsTextbox.appendChild(lineElement);
    });
    
    resultsTextbox.style.color = '#333';
    
  } catch (error) {
    console.warn('Calendar integration failed:', error);
    
    // Graceful degradation - show results with warning
    resultsTextbox.innerHTML = '';
    
    const errorElement = document.createElement('div');
    errorElement.textContent = '⚠️ Calendar integration unavailable - using default color coding';
    errorElement.style.cssText = `
      color: #721c24;
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      padding: 4px 6px;
      border-radius: 3px;
      margin-bottom: 8px;
      font-size: 11px;
    `;
    resultsTextbox.appendChild(errorElement);
    
    // Show results with default green background
    convertedLines.forEach(line => {
      const lineElement = document.createElement('div');
      lineElement.style.padding = '2px 0';
      
      if (line.trim() === '') {
        lineElement.innerHTML = '&nbsp;';
      } else if (line.startsWith('Timezone:')) {
        lineElement.textContent = line;
        lineElement.style.fontWeight = 'bold';
      } else {
        // Add default availability indicator
        lineElement.textContent = '✅ ' + line;
        lineElement.style.backgroundColor = '#d4f8d4'; // Default green
        lineElement.style.borderRadius = '3px';
        lineElement.style.padding = '4px 6px';
        lineElement.style.marginBottom = '2px';
      }
      
      resultsTextbox.appendChild(lineElement);
    });
    
    resultsTextbox.style.color = '#333';
    
    // Auto-size the results textbox based on content
    autoSizeResultsTextbox(resultsTextbox);
  }
}

// Calendar Integration Functions (Google Calendar DOM reading)

// Check if we're on Google Calendar
function isOnGoogleCalendar() {
  return window.location.hostname === 'calendar.google.com';
}

// Debug function to analyze Google Calendar's DOM structure
function debugCalendarDOM() {
  if (!isOnGoogleCalendar()) {
    console.log('Not on Google Calendar - debug skipped');
    return;
  }
  
  console.log('=== Calendar DOM Debug Analysis ===');
  
  // 1. Week date detection analysis
  console.log('\n--- Week Date Detection ---');
  const weekDates = getCurrentWeekDates();
  console.log('Week dates found:', weekDates);
  
  const dateKeyElements = document.querySelectorAll('[data-datekey]');
  console.log('Elements with data-datekey:', dateKeyElements.length);
  dateKeyElements.forEach((el, i) => {
    if (i < 5) console.log(`  [${i}] datekey: ${el.getAttribute('data-datekey')}, text: "${el.textContent?.trim()}"`, el);
  });
  
  // Alternative date selectors
  const altDateSelectors = ['.QS8ntf', '.uAKqid', '.Ls54aq', '[role="columnheader"]', '.eObXpf'];
  altDateSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Elements with ${selector}:`, elements.length);
      elements.forEach((el, i) => {
        if (i < 3) console.log(`  [${i}] text: "${el.textContent?.trim()}"`, el);
      });
    }
  });
  
  // 2. Event element identification
  console.log('\n--- Event Element Identification ---');
  const events = getCalendarEvents();
  console.log('Events found by getCalendarEvents():', events.length, events);
  
  const eventSelectors = [
    '[data-eventid]',
    '.EaCxIb', 
    '.bze0vd', 
    '[role="button"][data-tooltip]',
    '[role="button"][aria-label*=":"]',
    '.event',
    '.xJNT6'
  ];
  
  eventSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Elements with ${selector}:`, elements.length);
      elements.forEach((el, i) => {
        if (i < 3) {
          console.log(`  [${i}] text: "${el.textContent?.trim()}", tooltip: "${el.getAttribute('data-tooltip') || el.title}"`, el);
        }
      });
    }
  });
  
  // 3. Time pattern matching
  console.log('\n--- Time Pattern Analysis ---');
  const timePatterns = [/\d{1,2}:\d{2}\s*(AM|PM)/i, /\d{1,2}(AM|PM)/i];
  const allElements = document.querySelectorAll('*');
  const timeElements = [];
  
  allElements.forEach(el => {
    const text = el.textContent?.trim();
    const rect = el.getBoundingClientRect();
    
    if (text && rect.width > 0 && rect.height > 0) {
      timePatterns.forEach(pattern => {
        if (pattern.test(text)) {
          timeElements.push({
            element: el,
            text: text,
            selector: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
            bounds: {width: rect.width, height: rect.height}
          });
        }
      });
    }
  });
  
  console.log('Elements with time patterns:', timeElements.length);
  timeElements.slice(0, 10).forEach((item, i) => {
    console.log(`  [${i}] "${item.text}" - ${item.selector}`, item.element);
  });
  
  // 4. DOM structure sampling
  console.log('\n--- DOM Structure Sampling ---');
  const sampleSelectors = [
    '[class*="event"]',
    '[class*="time"]', 
    '[class*="slot"]',
    '[class*="calendar"]',
    '[aria-label*="event"]',
    '[title*=":"]'
  ];
  
  sampleSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Sample ${selector}:`, elements.length, 'found');
      elements.forEach((el, i) => {
        if (i < 2) {
          console.log(`  [${i}] classes: "${el.className?.toString()}", text: "${el.textContent?.trim().substring(0, 50)}"`, el);
        }
      });
    }
  });
  
  // 5. Visibility verification
  console.log('\n--- Visibility Verification ---');
  const visibleElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 10 && rect.height > 10 && 
           rect.top >= 0 && rect.left >= 0 && 
           rect.bottom <= window.innerHeight + 100;
  });
  
  console.log('Total visible elements:', visibleElements.length);
  
  // Look for calendar grid structure
  const gridElements = visibleElements.filter(el => 
    el.textContent?.includes(':') || 
    el.getAttribute('role') === 'gridcell' ||
    (el.className && el.className.toString().includes('time')) ||
    (el.className && el.className.toString().includes('event'))
  );
  
  console.log('Potential calendar grid elements:', gridElements.length);
  gridElements.slice(0, 5).forEach((el, i) => {
    const className = el.className?.toString();
    const firstClass = className ? className.split(' ')[0] : '';
    console.log(`  [${i}] "${el.textContent?.trim().substring(0, 30)}" - ${el.tagName}.${firstClass}`, el);
  });
  
  console.log('\n=== End Debug Analysis ===');
}

// Get current week dates from Google Calendar DOM
function getCurrentWeekDates() {
  if (!isOnGoogleCalendar()) return null;
  
  try {
    const dates = [];
    
    // Updated selectors for current Google Calendar interface
    // Look for day headers with date numbers using multiple strategies
    let dayHeaders = document.querySelectorAll('[role="columnheader"]');
    
    // Fallback: try other selectors if columnheader doesn't work
    if (dayHeaders.length === 0) {
      dayHeaders = document.querySelectorAll('[data-viewkey="WEEK"] .Lxx7f, [data-viewkey*="WEEK"] [class*="day"], .cNTTKd, .uAKqid');
    }
    
    // Fallback 2: look for elements containing day abbreviations and numbers
    if (dayHeaders.length === 0) {
      console.log('Searching for day headers in all elements...');
      const allElements = document.querySelectorAll('*');
      const potentialHeaders = [];
      
      allElements.forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text && text.length < 50) { // Only check short text elements
          // Look for various day/date patterns
          if (/^(SUN|MON|TUE|WED|THU|FRI|SAT)\s*\d{1,2}$/.test(text) ||
              /^\d{1,2}$/.test(text) ||
              text.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*\d{1,2}$/)) {
            potentialHeaders.push(el);
            if (index < 20) { // Log first 20 matches
              console.log(`Found potential day header: "${text}"`, el);
            }
          }
        }
      });
      
      console.log(`Found ${potentialHeaders.length} potential day headers`);
      dayHeaders = potentialHeaders;
    }
    
    console.log(`Final dayHeaders count: ${dayHeaders.length}`);
    
    dayHeaders.forEach((header, index) => {
      // Try to extract date from text content like "SUN 22", "MON 23", etc.
      const text = header.textContent?.trim();
      
      if (index < 10) { // Debug first 10 headers
        console.log(`Day header ${index}: "${text}"`);
      }
      
      // Try multiple regex patterns
      let dayMatch = text?.match(/\w{3}\s+(\d{1,2})/); // Matches "MON 23"
      if (!dayMatch) {
        dayMatch = text?.match(/(\d{1,2})/); // Just extract any number
      }
      
      if (dayMatch) {
        const dayNum = parseInt(dayMatch[1]);
        console.log(`Extracted day number: ${dayNum} from "${text}"`);
        
        // Get the current month/year from page context - try multiple selectors
        let monthYearText = document.querySelector('.sh7Io, .t7mmSb, [jsname="M8Jgzd"]')?.textContent;
        
        // Try alternative selectors if the first one fails
        if (!monthYearText) {
          const alternativeSelectors = [
            'h1[data-font="Google Sans"]',
            '.VfPpkd-Bz112c-LgbsSe.yHy1rc.eT1oJ.mN1ivc',
            '[role="button"][aria-label*="2025"]',
            'h1',
            '[class*="month"]',
            '[class*="year"]',
            'button[aria-label*="2025"]'
          ];
          
          for (const selector of alternativeSelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent?.includes('2025')) {
              monthYearText = element.textContent;
              console.log(`Found month/year text with selector "${selector}": "${monthYearText}"`);
              break;
            }
          }
        }
        
        let month = new Date().getMonth();
        let year = new Date().getFullYear();
        
        console.log(`Month/Year text found: "${monthYearText}"`);
        
        if (monthYearText) {
          // Handle cross-month spans like "Jun – Jul 2025"
          const crossMonthMatch = monthYearText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[–-]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/);
          const singleMonthMatch = monthYearText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/);
          
          if (crossMonthMatch) {
            const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const startMonth = monthAbbrs.indexOf(crossMonthMatch[1]);
            year = parseInt(crossMonthMatch[3]);
            
            // For cross-month weeks, we need to determine which month the day belongs to
            // We'll use the start month for now and adjust if needed
            month = startMonth;
            console.log(`Cross-month span detected: ${crossMonthMatch[1]} - ${crossMonthMatch[2]} ${year}, using start month ${startMonth}`);
          } else if (singleMonthMatch) {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            month = monthNames.indexOf(singleMonthMatch[1]);
            year = parseInt(singleMonthMatch[2]);
            console.log(`Single month detected: ${singleMonthMatch[1]} ${year}`);
          }
        }
        
        // Smart month assignment for cross-month weeks when title isn't found
        let finalMonth = month;
        if (!monthYearText) {
          // If we can't find the title, use heuristics based on day numbers
          // In cross-month weeks, typically days 1-7 are the next month, days 29-31 are current month
          const currentMonth = new Date().getMonth();
          if (dayNum <= 7 && currentMonth === 5) { // June (5) to July (6)
            finalMonth = 6; // July
            console.log(`Day ${dayNum} assigned to July (heuristic - cross-month week)`);
          } else if (dayNum >= 29) {
            finalMonth = currentMonth; // Keep current month
            console.log(`Day ${dayNum} assigned to current month ${currentMonth} (heuristic)`);
          } else {
            finalMonth = currentMonth;
            console.log(`Day ${dayNum} assigned to current month ${currentMonth} (default)`);
          }
        }
        
        dates.push(new Date(year, finalMonth, dayNum));
      }
    });
    
    // Fallback: try data-datekey approach
    if (dates.length === 0) {
      const dateKeyElements = document.querySelectorAll('[data-datekey]');
      dateKeyElements.forEach(element => {
        const dateKey = element.getAttribute('data-datekey');
        if (dateKey && dateKey.length === 8) {
          const year = parseInt(dateKey.substring(0, 4));
          const month = parseInt(dateKey.substring(4, 6)) - 1;
          const day = parseInt(dateKey.substring(6, 8));
          dates.push(new Date(year, month, day));
        }
      });
    }
    
    console.log('📅 CALENDAR WEEK DATES DEBUG:');
    
    // Try to find calendar title with multiple selectors  
    let debugCalendarTitle = document.querySelector('.sh7Io, .t7mmSb, [jsname="M8Jgzd"]')?.textContent;
    if (!debugCalendarTitle) {
      const titleSelectors = ['h1[data-font="Google Sans"]', 'h1', '[role="button"][aria-label*="2025"]'];
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element?.textContent?.includes('2025')) {
          debugCalendarTitle = element.textContent;
          break;
        }
      }
    }
    
    console.log('  Month/Year text:', debugCalendarTitle);
    console.log('  Final extracted dates:', dates.map(d => ({
      date: d.toDateString(),
      month: d.getMonth(),
      day: d.getDate(),
      year: d.getFullYear()
    })));
    
    return dates.length > 0 ? dates : null;
  } catch (error) {
    console.warn('Failed to extract calendar week dates:', error);
    return null;
  }
}

// Calculate full week span (Sunday to Sunday) from calendar dates
function calculateFullWeekSpan(calendarWeekDates) {
  if (!calendarWeekDates || calendarWeekDates.length === 0) {
    return null;
  }
  
  // Find the earliest and latest dates
  const earliestDate = new Date(Math.min(...calendarWeekDates));
  const latestDate = new Date(Math.max(...calendarWeekDates));
  
  // Calculate Sunday of the week containing the earliest date
  const weekStart = new Date(earliestDate);
  weekStart.setDate(earliestDate.getDate() - earliestDate.getDay()); // Go back to Sunday
  
  // Calculate Saturday of the week (6 days after Sunday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  console.log('Week span calculation:', {
    visibleDates: calendarWeekDates.map(d => d.toDateString()),
    earliestVisible: earliestDate.toDateString(),
    latestVisible: latestDate.toDateString(),
    calculatedWeekStart: weekStart.toDateString(),
    calculatedWeekEnd: weekEnd.toDateString()
  });
  
  return { weekStart, weekEnd };
}

// Flexible validation: check if ANY extracted dates fall within current calendar week
function validateDatesInCurrentWeek(extractedDates, calendarWeekDates) {
  if (!calendarWeekDates || calendarWeekDates.length === 0) {
    return { valid: false, error: 'Could not read current calendar week' };
  }
  
  const weekSpan = calculateFullWeekSpan(calendarWeekDates);
  if (!weekSpan) {
    return { valid: false, error: 'Could not calculate week span from calendar dates' };
  }
  
  const { weekStart, weekEnd } = weekSpan;
  
  // Check if ANY extracted dates fall within the week span
  const datesInWeek = [];
  const datesOutOfWeek = [];
  
  extractedDates.forEach(date => {
    if (date >= weekStart && date <= weekEnd) {
      datesInWeek.push(date);
    } else {
      datesOutOfWeek.push(date);
    }
  });
  
  console.log('🔍 DETAILED DATE VALIDATION DEBUG:');
  
  // Try to find calendar title with multiple selectors
  let calendarTitle = document.querySelector('.sh7Io, .t7mmSb, [jsname="M8Jgzd"]')?.textContent;
  if (!calendarTitle) {
    const titleSelectors = ['h1[data-font="Google Sans"]', 'h1', '[role="button"][aria-label*="2025"]'];
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.includes('2025')) {
        calendarTitle = element.textContent;
        break;
      }
    }
  }
  
  console.log('  Calendar title text:', calendarTitle);
  console.log('  Calculated week span:', {
    weekStart: weekStart.toDateString(),
    weekEnd: weekEnd.toDateString()
  });
  console.log('  Extracted dates from text:', extractedDates.map(d => ({
    date: d.toDateString(),
    month: d.getMonth(),
    day: d.getDate(),
    year: d.getFullYear()
  })));
  console.log('  Dates in week:', datesInWeek.map(d => d.toDateString()));
  console.log('  Dates out of week:', datesOutOfWeek.map(d => d.toDateString()));
  console.log('  Validation result:', datesInWeek.length > 0 ? 'PASS' : 'FAIL');
  
  // Debug: Show detailed comparison for each extracted date
  console.log('  DETAILED DATE COMPARISON:');
  extractedDates.forEach((date, i) => {
    const inWeek = date >= weekStart && date <= weekEnd;
    console.log(`    [${i}] ${date.toDateString()} (${date.getTime()}) - ${inWeek ? 'IN WEEK' : 'OUT OF WEEK'}`);
    console.log(`        vs weekStart: ${weekStart.toDateString()} (${weekStart.getTime()})`);
    console.log(`        vs weekEnd: ${weekEnd.toDateString()} (${weekEnd.getTime()})`);
  });
  
  // Permissive validation: if ANY dates are in the week, we proceed
  if (datesInWeek.length > 0) {
    return { valid: true, allowOverflow: datesOutOfWeek.length > 0 };
  }
  
  // TEMPORARY FIX: For cross-month weeks, be more lenient
  // Check if the calendar title contains a dash (indicating cross-month)
  const monthYearText = document.querySelector('.sh7Io, .t7mmSb, [jsname="M8Jgzd"]')?.textContent;
  if (monthYearText && monthYearText.includes('–')) {
    console.log('Cross-month week detected, allowing validation to pass');
    return { valid: true, allowOverflow: true };
  }
  
  // No dates fall within the current week
  const startDate = extractedDates[0];
  const startDateStr = startDate.toLocaleDateString('en-US', { 
    weekday: 'short', month: 'short', day: 'numeric' 
  });
  
  return { 
    valid: false, 
    error: `Please navigate to the week containing the start date ${startDateStr} in your calendar` 
  };
}

// Extract existing calendar events from DOM with multiple strategies
function getCalendarEvents() {
  if (!isOnGoogleCalendar()) return [];
  
  try {
    const events = [];
    
    // Strategy 1: Look for event elements with data-eventid
    const eventSelectors = [
      // WORKING: From diagnostic - these actually find events
      '[data-eventchip]',              // Main accepted event selector
      '[jsname="XPtOyb"]',             // Alternative event selector
      '[aria-label*=":"]',             // Events with time in aria-label
      '[title*=":"]',                  // Events with time in title
      
      // UNACCEPTED MEETINGS: From diagnostic findings (comprehensive list)
      '.fFwDnf',                       // Main unaccepted meeting class
      '.lhydbb',                       // Unaccepted meeting class variant
      '.KcY3wb',                       // Another unaccepted meeting class  
      '.IQUhYr',                       // Fourth unaccepted meeting class
      '.RlDtYe',                       // Additional unaccepted meeting class
      '.mXmilvb',                      // Additional unaccepted class #6
      '.ogBSbf',                       // Additional unaccepted class #7
      '.u4si0c',                       // Additional unaccepted class #8
      '.j0nwNb',                       // Additional unaccepted class #9
      '.K2fuAf',                       // Additional unaccepted class #10
      '.pbeTDb',                       // Additional unaccepted class #11
      '.YoYtqb',                       // Additional unaccepted class #12
      '.nwPtud',                       // Additional unaccepted class #13
      '.eh5oYe',                       // Additional unaccepted class #14
      '.RumPDb',                       // Additional unaccepted class #15
      '.tkdBcb',                       // Additional unaccepted class #16
      '.oXZlyb',                       // Additional unaccepted class #17
      '.TBh5bd',                       // Additional unaccepted class #18
      '.uEzZIb',                       // Additional unaccepted class #19
      
      // FALLBACK: Original selectors
      '[data-eventid]',
      '.DM879e.Et1Dfe',
      '.lOneve',
      '.thflMc', 
      '.tkd8cb',
      '.P7r1if',
      '.uHlQvb.sQjuj',
      'button[data-eventid]',
      '[data-dragsource-type]',
      '[data-dateslot]',
      '[data-viewfamily="EVENT"]',
      '.DM879e',
      '.Et1Dfe',
      '.EaCxIb', 
      '.bze0vd', 
      '[role="button"][data-tooltip]',
      '[role="button"][aria-label*=":"]',
      '.event',
      '.xJNT6',
      '[jsaction*="click"]:not([role="button"])',
      '.rjuR8e',
      '.OcVpRe'
    ];
    
    eventSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          // Filter out overly large elements (likely containers)
          const rect = element.getBoundingClientRect();
          if (rect.width > 500 || rect.height > 200) {
            // This is probably a container - look for child elements instead
            const childEvents = element.querySelectorAll('*');
            childEvents.forEach(child => {
              const childRect = child.getBoundingClientRect();
              if (childRect.width >= 50 && childRect.width <= 500 && 
                  childRect.height >= 15 && childRect.height <= 200 &&
                  child.textContent?.trim().length > 3) {
                const eventData = extractEventData(child);
                if (eventData && !events.some(e => e.element === child)) {
                  events.push(eventData);
                }
              }
            });
          } else {
            // Regular sized element - process normally
            const eventData = extractEventData(element);
            if (eventData && !events.some(e => e.element === element)) {
              events.push(eventData);
            }
          }
        });
      } catch (error) {
        console.warn(`Failed to query selector ${selector}:`, error);
      }
    });
    
    // Strategy 2: Smart text-based detection (based on diagnostic success)
    if (events.length === 0) {
      console.log('🔄 Selector-based detection failed, trying smart text detection...');
      
      // Find elements that contain event-like text patterns and have reasonable positioning
      const eventCandidates = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.trim();
        const rect = el.getBoundingClientRect();
        
        // Must have reasonable size and be visible
        if (!text || rect.width < 30 || rect.height < 15 || rect.width > 400 || rect.height > 100) {
          return false;
        }
        
        // Look for event-like text patterns from diagnostic
        const eventPatterns = [
          /Weekly CEO Team/i,
          /FDE team meeting/i,
          /Diego\/Quinn/i,
          /Lori\/Quinn/i,
          /Company meeting/i,
          // General patterns
          /\b(meeting|call|sync|chat|standup|review|demo|training)\b/i,
          /\b(lunch|coffee|1:1|one.on.one)\b/i,
          /\d{1,2}:\d{2}\s*(am|pm)/i,  // Contains time
          /\w+\/\w+/,  // Names with slash like "Diego/Quinn"
        ];
        
        return eventPatterns.some(pattern => pattern.test(text));
      });
      
      console.log(`Found ${eventCandidates.length} event candidates via text detection`);
      
      eventCandidates.forEach(element => {
        const eventData = extractEventData(element);
        if (eventData && !events.some(e => e.element === element)) {
          events.push(eventData);
          console.log(`✓ Added event via text detection: "${eventData.text?.substring(0, 30)}"`);
        }
      });
    }
    
    // Strategy 3: Look for colored blocks in calendar grid (fallback)
    if (events.length === 0) {
      console.log('🔄 Text detection failed, trying color-based detection...');
      
      const coloredElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return rect.width > 20 && rect.height > 15 && 
               (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                style.backgroundColor !== 'transparent' &&
                style.backgroundColor !== 'rgb(255, 255, 255)');
      });
      
      coloredElements.forEach(element => {
        const eventData = extractEventData(element);
        if (eventData) {
          events.push(eventData);
        }
      });
    }
    
    console.log(`Calendar events found: ${events.length} using ${events.length > 0 ? 'successful' : 'failed'} detection`);
    
    // Debug: log first few events for verification
    if (events.length > 0) {
      console.log('First few events detected:', events.slice(0, 3).map(e => ({
        text: e.text?.substring(0, 30),
        date: e.date?.toDateString(),
        hasDateKey: !!e.date
      })));
    } else {
      console.warn('❌ No calendar events detected! The extension may not work properly.');
      console.log('Debug: Try running the calendar debug script to investigate.');
    }
    
    return events;
  } catch (error) {
    console.warn('Failed to extract calendar events:', error);
    return [];
  }
}

// Extract event data from DOM element
function extractEventData(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  // Try to get event time from various attributes or text
  const eventText = element.textContent?.trim() || '';
  const tooltip = element.getAttribute('data-tooltip') || element.title || '';
  
  // Strategy 1: Look for parent containers that might have date/time info
  let dateContainer = element.closest('[data-datekey]') || 
                      element.closest('[data-dateslot]') ||
                      element.closest('[data-date]') ||
                      element.closest('[data-viewfamily="EVENT"]') ||
                      element.closest('[jsslot]');
  
  let dateKey = dateContainer?.getAttribute('data-datekey') || 
                dateContainer?.getAttribute('data-dateslot') ||
                dateContainer?.getAttribute('data-date') ||
                dateContainer?.getAttribute('jsslot');
  
  if (dateKey) {
    // Parse datekey (YYYYMMDD format) or data-dateslot format
    let year, month, day;
    
    if (dateKey.length === 8 && /^\d{8}$/.test(dateKey)) {
      // Standard YYYYMMDD format
      year = parseInt(dateKey.substring(0, 4));
      month = parseInt(dateKey.substring(4, 6)) - 1;
      day = parseInt(dateKey.substring(6, 8));
    } else if (dateKey.includes('-')) {
      // ISO date format like "2025-06-30"
      const dateParts = dateKey.split('-');
      if (dateParts.length >= 3) {
        year = parseInt(dateParts[0]);
        month = parseInt(dateParts[1]) - 1;
        day = parseInt(dateParts[2]);
      }
    } else {
      // Unknown dateKey format - could be Google's internal encoding
      // Fall back to position-based detection instead of failing
      console.log(`Unknown dateKey format: ${dateKey}, will use position-based detection`);
      dateKey = null; // Clear it so we fall through to position detection
    }
    
    // Only return parsed date if we successfully got year/month/day
    if (year !== undefined && month !== undefined && day !== undefined) {
      return {
        element: element,
        date: new Date(year, month, day),
        text: eventText,
        tooltip: tooltip,
        bounds: rect,
        top: rect.top,
        height: rect.height
      };
    }
    // If parsing failed, fall through to position detection
  }
  
  // Strategy 2: Estimate date based on element position relative to week grid
  const weekDates = getCurrentWeekDates();
  if (weekDates && weekDates.length > 0) {
    // Try multiple container selectors for the week view
    const containerSelectors = [
      '[data-viewkey="WEEK"]',
      '[data-prefetch-view-key="WEEK"]',
      '.fqRpMf',
      '.JdOhC',
      '[role="main"]',
      '.CbHTMb'
    ];
    
    let calendarContainer = null;
    for (const selector of containerSelectors) {
      calendarContainer = document.querySelector(selector);
      if (calendarContainer) {
        console.log(`Found calendar container with selector: ${selector}`);
        break;
      }
    }
    
    if (calendarContainer) {
      const containerRect = calendarContainer.getBoundingClientRect();
      const dayWidth = containerRect.width / 7;
      const relativeX = rect.left - containerRect.left;
      const dayIndex = Math.floor(relativeX / dayWidth);
      
      console.log(`Event position analysis: left=${rect.left}, containerLeft=${containerRect.left}, relativeX=${relativeX}, dayWidth=${dayWidth}, dayIndex=${dayIndex}`);
      
      if (dayIndex >= 0 && dayIndex < weekDates.length) {
        console.log(`Event "${eventText}" estimated to be on day ${dayIndex}: ${weekDates[dayIndex].toDateString()}`);
        return {
          element: element,
          date: weekDates[dayIndex],
          text: eventText,
          tooltip: tooltip,
          bounds: rect,
          top: rect.top,
          height: rect.height,
          dateKey: `position-${dayIndex}`
        };
      }
    } else {
      console.warn('No calendar container found for position-based date detection');
    }
  }
  
  // Strategy 3: Return event without date (for debugging)
  if (eventText.length > 0 && rect.width > 20 && rect.height > 15) {
    console.log(`Event "${eventText}" found but no date assigned`);
    return {
      element: element,
      date: null,
      text: eventText,
      tooltip: tooltip,
      bounds: rect,
      top: rect.top,
      height: rect.height
    };
  }
  
  return null;
}

// Helper function to convert time string to minutes since midnight
function timeToMinutes(timeStr) {
  const match = timeStr.match(/(\d{1,2}):(\d{2})([ap]m)/);
  if (!match) return 0;
  
  let [, hours, minutes, ampm] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);
  
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}

// Check for conflicts using Calendar API data
function checkTimeSlotConflicts(timeSlot, calendarEvents, targetTimezone) {
  console.log(`📅 checkTimeSlotConflicts: Checking conflicts using API data`);
  try {
    const slotDate = extractDateFromLine(timeSlot);
    console.log(`Conflict check - slot: "${timeSlot}", extracted date:`, slotDate);
    
    if (!slotDate) {
      console.log('No date extracted from slot, returning no conflicts');
      return { conflictLevel: 'none', percentage: 0 };
    }

    // Extract time from the availability slot
    const timeMatch = timeSlot.match(/.*?(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*.*?(\d{1,2}:\d{2}[ap]m)/);
    if (!timeMatch) {
      console.log('No time found in slot, returning no conflicts');
      return { conflictLevel: 'none', percentage: 0 };
    }

    const [, startTimeStr, endTimeStr] = timeMatch;
    console.log(`Checking time conflict for ${startTimeStr} - ${endTimeStr}`);

    // Create full date-time objects for the slot
    const slotStart = new Date(slotDate);
    const slotEnd = new Date(slotDate);
    
    // Parse and set times
    const startMinutes = timeToMinutes(startTimeStr);
    const endMinutes = timeToMinutes(endTimeStr);
    
    slotStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    slotEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

    console.log(`Slot times: ${slotStart.toLocaleString()} - ${slotEnd.toLocaleString()}`);

    // Use Calendar API to check conflicts
    if (window.calendarAPI && calendarEvents && Array.isArray(calendarEvents)) {
      console.log(`📅 Using API conflict detection with ${calendarEvents.length} events`);
      
      // Filter events to same day
      const dayEvents = calendarEvents.filter(event => {
        const eventDate = new Date(event.start);
        return isSameDay(eventDate, slotDate);
      });

      console.log(`Found ${dayEvents.length} events on ${slotDate.toDateString()}`);

      // Check for overlaps using API conflict detection
      const conflictResult = window.calendarAPI.checkConflicts(dayEvents, slotStart, slotEnd);
      
      console.log(`✅ API conflict result:`, conflictResult);

      // Convert API result to our format
      if (conflictResult.status === 'free') {
        return { conflictLevel: 'none', percentage: 0 };
      } else if (conflictResult.status === 'blocked') {
        return { conflictLevel: 'full', percentage: 100 };
      } else {
        return { conflictLevel: 'partial', percentage: conflictResult.percentage };
      }
    }

    // Fallback to DOM parsing if API data not available
    console.log('⚠️ API data not available, falling back to DOM conflict detection');
    return checkTimeSlotConflictsDOMFallback(timeSlot, slotDate, startTimeStr, endTimeStr);

  } catch (error) {
    console.error('Error in conflict detection:', error);
    return { conflictLevel: 'none', percentage: 0 };
  }
}

// Fallback DOM-based conflict detection (simplified)
function checkTimeSlotConflictsDOMFallback(timeSlot, slotDate, startTimeStr, endTimeStr) {
  console.log('🔄 Using DOM fallback for conflict detection');
  
  // Find the day column for this date in the current week view
  const weekDates = getCurrentWeekDates();
  if (!weekDates || weekDates.length === 0) {
    console.log('No week dates available, returning no conflicts');
    return { conflictLevel: 'none', percentage: 0 };
  }
  
  const dayIndex = weekDates.findIndex(weekDate => isSameDay(weekDate, slotDate));
  
  if (dayIndex === -1) {
    console.log(`Date ${slotDate.toDateString()} not found in current week`);
    return { conflictLevel: 'none', percentage: 0 };
  }

  // Try to find day column headers to get bounds
  const dayHeaders = Array.from(document.querySelectorAll('[role="columnheader"]')).slice(0, 7);
  
  if (dayHeaders.length < 7 || !dayHeaders[dayIndex]) {
    console.log('Could not find day column headers');
    return { conflictLevel: 'none', percentage: 0 };
  }

  const headerRect = dayHeaders[dayIndex].getBoundingClientRect();
  const dayLeft = headerRect.left;
  const dayRight = headerRect.right;

  // Count events that fall within this day column (simplified)
  const eventsInDay = Array.from(document.querySelectorAll('*')).filter(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    
    const hasColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                    style.backgroundColor !== 'transparent' &&
                    style.backgroundColor !== 'rgb(255, 255, 255)';
    const hasSize = rect.width > 20 && rect.height > 15;
    const hasText = el.textContent?.trim().length > 0;
    const overlapsDay = (rect.left < dayRight && rect.right > dayLeft);
    
    return hasColor && hasSize && hasText && overlapsDay;
  });

  console.log(`DOM fallback found ${eventsInDay.length} events in day column`);

  // Simple conflict detection based on event count
  if (eventsInDay.length === 0) {
    return { conflictLevel: 'none', percentage: 0 };
  } else if (eventsInDay.length <= 2) {
    return { conflictLevel: 'partial', percentage: 40 };
  } else {
    return { conflictLevel: 'full', percentage: 80 };
  }
}

// Calculate available time segments from a time slot by removing conflicts
function calculateAvailableSegments(timeSlot, calendarEvents, targetTimezone, selectedDuration = null, bufferMinutes = 15) {
  try {
    const slotDate = extractDateFromLine(timeSlot);
    console.log(`Calculating available segments for: "${timeSlot}"`);
    
    if (!slotDate) {
      console.log('No date extracted from slot, returning original slot');
      return [{ timeSlot, available: true }];
    }
    
    // Extract time from the availability slot
    const timeMatch = timeSlot.match(/.*?(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*.*?(\d{1,2}:\d{2}[ap]m)/);
    if (!timeMatch) {
      console.log('No time found in slot, returning original slot');
      return [{ timeSlot, available: true }];
    }
    
    const [, startTime, endTime] = timeMatch;
    const slotStartMinutes = timeToMinutes(startTime);
    const slotEndMinutes = timeToMinutes(endTime);
    
    console.log(`Slot time: ${startTime} (${slotStartMinutes}min) - ${endTime} (${slotEndMinutes}min)`);
    
    // Get conflicting events for this day (calendar events are assumed to be in target timezone)
    const conflicts = getConflictingEvents(slotDate, slotStartMinutes, slotEndMinutes, calendarEvents, targetTimezone, bufferMinutes);
    console.log(`🔍 Conflicts found for ${slotDate.toDateString()} ${startTime}-${endTime}:`, conflicts.length);
    console.log(`📅 DEBUG: Processing date ${slotDate.toDateString()}, looking for day index in week`);
    
    if (conflicts.length === 0) {
      console.log('No conflicts found, returning original slot');
      return [{ timeSlot, available: true }];
    }
    
    // Sort conflicts by start time
    conflicts.sort((a, b) => a.start - b.start);
    console.log('Conflicts found:', conflicts.map(c => `${minutesToTime(c.start)}-${minutesToTime(c.end)}`));
    
    // Calculate available segments by removing conflict times
    const availableSegments = [];
    let currentStart = slotStartMinutes;
    
    for (const conflict of conflicts) {
      // If there's a gap before this conflict, it's available
      if (currentStart < conflict.start) {
        const segmentStart = minutesToTime(currentStart);
        const segmentEnd = minutesToTime(conflict.start);
        // Create new slot by intelligently replacing just the times
        let availableSlot;
        
        // Handle different formats: "Mon Jun 30, 3:00pm – Mon Jun 30, 8:00pm" or "Mon Jun 30, 3:00pm – 8:00pm"
        if (timeSlot.includes(' – ') && timeSlot.split(' – ').length === 2) {
          const parts = timeSlot.split(' – ');
          const startPart = parts[0]; // "Mon Jun 30, 3:00pm"
          const endPart = parts[1];   // "Mon Jun 30, 8:00pm" or "8:00pm"
          
          // Replace start time in first part
          const newStartPart = startPart.replace(/\d{1,2}:\d{2}[ap]m/, segmentStart);
          
          // For end part, if it has a date, keep it, otherwise just use the time
          let newEndPart;
          if (endPart.includes(',')) {
            // Full date format: "Mon Jun 30, 8:00pm"
            newEndPart = endPart.replace(/\d{1,2}:\d{2}[ap]m/, segmentEnd);
          } else {
            // Time only format: "8:00pm"
            newEndPart = segmentEnd;
          }
          
          availableSlot = `${newStartPart} – ${newEndPart}`;
        } else {
          // Fallback: simple replacement
          availableSlot = timeSlot.replace(
            /(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*.*?(\d{1,2}:\d{2}[ap]m)/,
            `${segmentStart} – ${segmentEnd}`
          );
        }
        
        // Check if segment meets minimum duration requirement
        if (selectedDuration) {
          const segmentDuration = calculateSegmentDuration(availableSlot);
          console.log(`⏱️ Checking segment duration: "${availableSlot}" = ${segmentDuration}min vs required ${selectedDuration}min`);
          if (segmentDuration >= selectedDuration) {
            availableSegments.push({ timeSlot: availableSlot, available: true });
            console.log(`✅ Available segment: ${segmentStart} - ${segmentEnd} -> "${availableSlot}" (${segmentDuration}min - meets ${selectedDuration}min requirement)`);
          } else {
            console.log(`❌ Skipping segment: ${segmentStart} - ${segmentEnd} -> "${availableSlot}" (${segmentDuration}min - below ${selectedDuration}min requirement)`);
          }
        } else {
          availableSegments.push({ timeSlot: availableSlot, available: true });
          console.log(`Available segment: ${segmentStart} - ${segmentEnd} -> "${availableSlot}" (no duration filter)`);
        }
      }
      
      // Move current start to end of this conflict
      currentStart = Math.max(currentStart, conflict.end);
    }
    
    // If there's time left after the last conflict, it's available
    if (currentStart < slotEndMinutes) {
      const segmentStart = minutesToTime(currentStart);
      const segmentEnd = minutesToTime(slotEndMinutes);
      // Create new slot by intelligently replacing just the times
      let availableSlot;
      
      // Handle different formats: "Mon Jun 30, 3:00pm – Mon Jun 30, 8:00pm" or "Mon Jun 30, 3:00pm – 8:00pm"
      if (timeSlot.includes(' – ') && timeSlot.split(' – ').length === 2) {
        const parts = timeSlot.split(' – ');
        const startPart = parts[0]; // "Mon Jun 30, 3:00pm"
        const endPart = parts[1];   // "Mon Jun 30, 8:00pm" or "8:00pm"
        
        // Replace start time in first part
        const newStartPart = startPart.replace(/\d{1,2}:\d{2}[ap]m/, segmentStart);
        
        // For end part, if it has a date, keep it, otherwise just use the time
        let newEndPart;
        if (endPart.includes(',')) {
          // Full date format: "Mon Jun 30, 8:00pm"
          newEndPart = endPart.replace(/\d{1,2}:\d{2}[ap]m/, segmentEnd);
        } else {
          // Time only format: "8:00pm"
          newEndPart = segmentEnd;
        }
        
        availableSlot = `${newStartPart} – ${newEndPart}`;
      } else {
        // Fallback: simple replacement
        availableSlot = timeSlot.replace(
          /(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*.*?(\d{1,2}:\d{2}[ap]m)/,
          `${segmentStart} – ${segmentEnd}`
        );
      }
      
      // Check if segment meets minimum duration requirement
      if (selectedDuration) {
        const segmentDuration = calculateSegmentDuration(availableSlot);
        console.log(`⏱️ Checking segment duration: "${availableSlot}" = ${segmentDuration}min vs required ${selectedDuration}min`);
        if (segmentDuration >= selectedDuration) {
          availableSegments.push({ timeSlot: availableSlot, available: true });
          console.log(`✅ Available segment: ${segmentStart} - ${segmentEnd} -> "${availableSlot}" (${segmentDuration}min - meets ${selectedDuration}min requirement)`);
        } else {
          console.log(`❌ Skipping segment: ${segmentStart} - ${segmentEnd} -> "${availableSlot}" (${segmentDuration}min - below ${selectedDuration}min requirement)`);
        }
      } else {
        availableSegments.push({ timeSlot: availableSlot, available: true });
        console.log(`Available segment: ${segmentStart} - ${segmentEnd} -> "${availableSlot}" (no duration filter)`);
      }
    }
    
    if (availableSegments.length === 0) {
      console.log('No available time segments found');
      return [{ timeSlot: timeSlot.replace(/(\d{1,2}:\d{2}[ap]m)\s*[–-]\s*(\d{1,2}:\d{2}[ap]m)/, 'No available time'), available: false }];
    }
    
    return availableSegments;
    
  } catch (error) {
    console.warn('Error calculating available segments:', error);
    return [{ timeSlot, available: true }];
  }
}

// Get conflicting events for a specific day and time range
function getConflictingEvents(slotDate, slotStartMinutes, slotEndMinutes, calendarEvents, calendarTimezone, bufferMinutes = 15) {
  const conflicts = [];
  
  console.log(`📅 Reading calendar events as ${calendarTimezone} timezone`);
  
  // Find the day column for this date
  const weekDates = getCurrentWeekDates();
  if (!weekDates || weekDates.length === 0) {
    return conflicts;
  }
  
  const dayIndex = weekDates.findIndex(weekDate => isSameDay(weekDate, slotDate));
  if (dayIndex === -1) {
    return conflicts;
  }
  
  // Get day column bounds - use actual column headers for precision
  const dayHeaders = Array.from(document.querySelectorAll('[role="columnheader"]')).slice(0, 7);
  
  if (dayHeaders.length < 7 || dayIndex < 0 || dayIndex >= dayHeaders.length) {
    console.warn(`Invalid day index ${dayIndex} or insufficient headers (${dayHeaders.length})`);
    return conflicts;
  }
  
  // Also get calendar container for position estimation functions
  const calendarContainer = document.querySelector('[data-viewkey="WEEK"]') || 
                           document.querySelector('.fqRpMf') || 
                           document.querySelector('.JdOhC') || 
                           document.querySelector('[role="main"]');
  
  if (!calendarContainer) {
    console.warn('Could not find calendar container for position estimation');
    return conflicts;
  }
  
  // Use actual header bounds for precise day column detection
  const targetHeader = dayHeaders[dayIndex];
  const headerRect = targetHeader.getBoundingClientRect();
  const dayLeft = headerRect.left;
  const dayRight = headerRect.right;
  
  console.log(`Day ${dayIndex} bounds: ${dayLeft.toFixed(0)} - ${dayRight.toFixed(0)} (width: ${(dayRight-dayLeft).toFixed(0)}px)`);
  
  // No buffer - use exact boundaries to prevent cross-day assignment
  const adjustedLeft = dayLeft;
  const adjustedRight = dayRight;
  
  // Find events in this day column - more permissive criteria
  const eventsInDay = Array.from(document.querySelectorAll('*')).filter(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const text = el.textContent?.trim() || '';
    
    // More permissive color detection
    const hasColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                    style.backgroundColor !== 'transparent' &&
                    style.backgroundColor !== 'rgb(255, 255, 255)' &&
                    style.backgroundColor !== 'rgba(255, 255, 255, 1)';
    
    // More permissive size requirements
    const hasSize = rect.width > 15 && rect.height > 10;
    
    // Check for event-like text patterns - exclude UI elements
    const hasEventText = text.length > 0 && (
      /\d{1,2}:\d{2}\s*(am|pm)/i.test(text) ||  // Contains time
      /lunch|meeting|chat|call|sync|team|office|home/i.test(text) ||  // Event keywords
      (text.length > 5 && !/^(change|settings|options|view|filter|more|add|edit|delete|create|new)$/i.test(text))  // Reasonably long text but not UI words
    );
    
    // More precise day assignment: event center must be in the day column
    const eventCenter = (rect.left + rect.right) / 2;
    const overlapsDay = (eventCenter >= adjustedLeft && eventCenter <= adjustedRight);
    
    // Alternative: Accept elements with certain classes even without background color
    const hasEventClass = el.className && /event|meeting|appointment|busy/i.test(el.className);
    
    const isLikelyEvent = (hasColor && hasSize && hasEventText && overlapsDay) ||
                         (hasEventClass && hasSize && hasEventText && overlapsDay);
    
    return isLikelyEvent;
  });
  
  console.log(`📅 Found ${eventsInDay.length} events in day column for ${slotDate.toDateString()}`);
  
  // Debug: Show all potential events before filtering
  const allElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const overlapsDay = (rect.left < adjustedRight && rect.right > adjustedLeft);
    const hasText = el.textContent?.trim().length > 0;
    
    return overlapsDay && hasText && rect.width > 10 && rect.height > 5;
  });
  
  console.log(`📅 All potential events in day column: ${allElements.length}`);
  allElements.slice(0, 5).forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    console.log(`  Potential ${i}: "${el.textContent?.trim().substring(0, 50)}" (${rect.width.toFixed(0)}x${rect.height.toFixed(0)}, bg: ${style.backgroundColor})`);
  });
  
  // Extract time conflicts from events
  console.log(`\n🔍 DETAILED EVENT ANALYSIS FOR ${slotDate.toDateString()}:`);
  console.log(`Day index: ${dayIndex}, Looking for conflicts between ${slotStartMinutes}-${slotEndMinutes} minutes`);
  
  eventsInDay.forEach((event, index) => {
  const eventText = event.textContent?.trim() || '';
  const eventRect = event.getBoundingClientRect();
  const eventStyle = window.getComputedStyle(event);
  
  console.log(`\n📅 Event ${index}: "${eventText.substring(0, 80)}"`);
  console.log(`  Position: x=${eventRect.left.toFixed(0)}-${eventRect.right.toFixed(0)}, y=${eventRect.top.toFixed(0)}-${eventRect.bottom.toFixed(0)}`);
  console.log(`  Size: ${eventRect.width.toFixed(0)}x${eventRect.height.toFixed(0)}`);
  console.log(`  Background: ${eventStyle.backgroundColor}`);
  console.log(`  Classes: ${event.className}`);
  console.log(`  Element:`, event);
  
  // Show why this event was assigned to this day
  const dayColumn = dayHeaders[dayIndex];
  const dayRect = dayColumn.getBoundingClientRect();
  const eventCenter = (eventRect.left + eventRect.right) / 2;
  const isInColumn = eventCenter >= dayRect.left && eventCenter <= dayRect.right;
  console.log(`  Day assignment: Day column ${dayRect.left.toFixed(0)}-${dayRect.right.toFixed(0)}, event center: ${eventCenter.toFixed(0)}, assigned: ${isInColumn}`);
  
  // Enhanced time pattern matching for Google Calendar format (same as above)
  const timePatterns = [
  /(\d{1,2}):(\d{2})\s*(am|pm)\s*(?:to|[-–])\s*(\d{1,2}):(\d{2})\s*(am|pm)/i, // "10:30am to 11:00am"
  /(\d{1,2})\s*(am|pm)\s*(?:to|[-–])\s*(\d{1,2}):(\d{2})\s*(am|pm)/i,         // "10am to 10:40am"  
  /(\d{1,2}):(\d{2})\s*(am|pm)\s*(?:to|[-–])\s*(\d{1,2})\s*(am|pm)/i,         // "10:30am to 11am"
  /(\d{1,2})\s*(am|pm)\s*(?:to|[-–])\s*(\d{1,2})\s*(am|pm)/i                  // "10am to 11am"
  ];
  
  let timeMatch = null;
  let matchedPattern = -1;
  
  for (let i = 0; i < timePatterns.length; i++) {
  timeMatch = eventText.match(timePatterns[i]);
  if (timeMatch) {
  matchedPattern = i;
  console.log(`    ✓ Matched time pattern ${i}: "${timeMatch[0]}" in "${eventText.substring(0, 50)}"`);
  break;
  }
  }
    
    if (!timeMatch) {
      console.log(`    ✗ No time pattern matched for: "${eventText}"`);
      
      // For now, skip position-based estimation to avoid errors
      // TODO: Fix position-based detection later
      return;
    }
    
    if (timeMatch) {
      // Parse based on which pattern matched (same logic as conflict detection above)
      let startHour, startMin, startAmPm, endHour, endMin, endAmPm;
      
      if (matchedPattern === 0) { // "10:30am to 11:00am"
        [, startHour, startMin, startAmPm, endHour, endMin, endAmPm] = timeMatch;
      } else if (matchedPattern === 1) { // "10am to 10:40am"  
        [, startHour, startAmPm, endHour, endMin, endAmPm] = timeMatch;
        startMin = '0'; // No minutes specified for start time
      } else if (matchedPattern === 2) { // "10:30am to 11am"
        [, startHour, startMin, startAmPm, endHour, endAmPm] = timeMatch;
        endMin = '0'; // No minutes specified for end time
      } else if (matchedPattern === 3) { // "10am to 11am"
        [, startHour, startAmPm, endHour, endAmPm] = timeMatch;
        startMin = '0';
        endMin = '0';
      }
      
      console.log(`    Parsed: ${startHour}:${startMin || '0'}${startAmPm} - ${endHour}:${endMin || '0'}${endAmPm}`);
      
      let eventStart = parseInt(startHour) * 60 + parseInt(startMin);
      let eventEnd = parseInt(endHour) * 60 + parseInt(endMin);
      
      if (startAmPm.toLowerCase() === 'pm' && parseInt(startHour) !== 12) eventStart += 12 * 60;
      if (startAmPm.toLowerCase() === 'am' && parseInt(startHour) === 12) eventStart = parseInt(startMin);
      if (endAmPm.toLowerCase() === 'pm' && parseInt(endHour) !== 12) eventEnd += 12 * 60;
      if (endAmPm.toLowerCase() === 'am' && parseInt(endHour) === 12) eventEnd = parseInt(endMin);
      
      // Skip very long events (likely all-day)
      const eventDurationMinutes = eventEnd - eventStart;
      if (eventDurationMinutes > 8 * 60) {
        return;
      }
      
      // Check for overlap with requested slot
      const overlapStart = Math.max(slotStartMinutes, eventStart);
      const overlapEnd = Math.min(slotEndMinutes, eventEnd);
      
      console.log(`  🔍 Overlap check: event ${minutesToTime(eventStart)}-${minutesToTime(eventEnd)} vs slot ${minutesToTime(slotStartMinutes)}-${minutesToTime(slotEndMinutes)}`);
      console.log(`    Overlap: ${minutesToTime(overlapStart)}-${minutesToTime(overlapEnd)} (${overlapStart < overlapEnd ? 'CONFLICT' : 'no conflict'})`);
      
      if (overlapStart < overlapEnd) {
        // Add configurable buffer before and after the event
        const bufferedStart = Math.max(0, eventStart - bufferMinutes); // Don't go below 0 (midnight)
        const bufferedEnd = Math.min(24 * 60, eventEnd + bufferMinutes); // Don't go beyond 24:00
        
        console.log(`  🚨 CREATING CONFLICT: "${eventText.substring(0, 40)}" (${minutesToTime(eventStart)}-${minutesToTime(eventEnd)})`);
        console.log(`    📏 Adding ${bufferMinutes}min buffer: ${minutesToTime(bufferedStart)}-${minutesToTime(bufferedEnd)}`);
        
        conflicts.push({
          start: bufferedStart,
          end: bufferedEnd,
          text: eventText.substring(0, 40),
          element: event  // Add element reference for debugging
        });
      }
    } else {
      // FALLBACK: Use vertical position to estimate time (for events without time text)
      const rect = event.getBoundingClientRect();
      let estimatedTime = null;
      
      try {
        estimatedTime = estimateTimeFromPosition(rect, calendarContainer);
      } catch (error) {
        console.warn('Failed to estimate time from position:', error);
      }
      
      if (estimatedTime) {
        console.log(`    Estimated time from position: ${estimatedTime.start}-${estimatedTime.end} for "${eventText.substring(0, 30)}"`);
        
        // Skip very long events (likely all-day or multi-hour blocks)
        const eventDurationMinutes = estimatedTime.end - estimatedTime.start;
        if (eventDurationMinutes > 8 * 60) {
          console.log(`    Skipping long event (${eventDurationMinutes}min): "${eventText.substring(0, 30)}"`);
          return;
        }
        
        // Check for overlap with requested slot
        const overlapStart = Math.max(slotStartMinutes, estimatedTime.start);
        const overlapEnd = Math.min(slotEndMinutes, estimatedTime.end);
        
        if (overlapStart < overlapEnd) {
          // Add configurable buffer before and after the estimated event
          const bufferedStart = Math.max(0, estimatedTime.start - bufferMinutes);
          const bufferedEnd = Math.min(24 * 60, estimatedTime.end + bufferMinutes);
          
          conflicts.push({
            start: bufferedStart,
            end: bufferedEnd,
            text: eventText.substring(0, 40) + ' (estimated)'
          });
          console.log(`    ✓ Conflict detected: ${minutesToTime(estimatedTime.start)}-${minutesToTime(estimatedTime.end)}`);
          console.log(`    📏 Adding ${bufferMinutes}min buffer: ${minutesToTime(bufferedStart)}-${minutesToTime(bufferedEnd)}`);
        }
      }
    }
  });
  
  return conflicts;
}

// Estimate event time based on vertical position in calendar grid
function estimateTimeFromPosition(eventRect, calendarContainer) {
  try {
    // Ensure we have a valid calendar container
    if (!calendarContainer) {
      console.warn('No calendar container provided for position estimation');
      return null;
    }
    
    // Find the calendar grid area
    const containerRect = calendarContainer.getBoundingClientRect();
    
    // Look for time labels on the left side to calibrate our position calculations
    const timeLabels = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.textContent?.trim();
      const rect = el.getBoundingClientRect();
      
      // Look for elements that contain time patterns and are positioned on the left
      return text && 
             /^\d{1,2}\s*(AM|PM)$/.test(text) &&
             rect.left < containerRect.left + 100 && // Left side of calendar
             rect.top >= containerRect.top &&
             rect.bottom <= containerRect.bottom;
    });
    
    console.log(`Found ${timeLabels.length} time labels for position estimation`);
    
    if (timeLabels.length === 0) {
      // Fallback: Use standard calendar layout assumptions
      // Assume calendar starts at 12 AM and goes to 11 PM (24 hours total)
      const calendarHeight = containerRect.height;
      const hourHeight = calendarHeight / 24; // 24 hours visible
      
      const relativeTop = eventRect.top - containerRect.top;
      const relativeBottom = eventRect.bottom - containerRect.top;
      
      const startHour = Math.floor(relativeTop / hourHeight);
      const endHour = Math.ceil(relativeBottom / hourHeight);
      
      // Convert to minutes since midnight
      const startMinutes = startHour * 60;
      const endMinutes = Math.min(endHour * 60, startMinutes + 60); // Max 1 hour if no height info
      
      console.log(`Fallback time estimation: ${startHour}:00 - ${endHour}:00 (${startMinutes}min - ${endMinutes}min)`);
      
      return {
        start: startMinutes,
        end: endMinutes
      };
    }
    
    // Use actual time labels to calibrate position
    timeLabels.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    
    // Find the closest time labels above and below the event
    let beforeLabel = null, afterLabel = null;
    
    for (const label of timeLabels) {
      const labelRect = label.getBoundingClientRect();
      if (labelRect.top <= eventRect.top) {
        beforeLabel = { element: label, rect: labelRect };
      } else if (labelRect.top >= eventRect.bottom && !afterLabel) {
        afterLabel = { element: label, rect: labelRect };
        break;
      }
    }
    
    if (beforeLabel) {
      const beforeTime = parseTimeLabel(beforeLabel.element.textContent.trim());
      const eventTop = eventRect.top;
      const eventBottom = eventRect.bottom;
      const labelTop = beforeLabel.rect.top;
      
      let afterTime = beforeTime + 60; // Default to 1 hour later
      if (afterLabel) {
        afterTime = parseTimeLabel(afterLabel.element.textContent.trim());
      }
      
      // Calculate position within the hour
      const hourHeight = afterLabel ? 
        (afterLabel.rect.top - beforeLabel.rect.top) : 
        60; // Assume 60px per hour as fallback
      
      const eventStartOffset = (eventTop - labelTop) / hourHeight * 60;
      const eventEndOffset = (eventBottom - labelTop) / hourHeight * 60;
      
      const startMinutes = beforeTime + eventStartOffset;
      const endMinutes = beforeTime + eventEndOffset;
      
      // Round to reasonable 15-minute intervals
      const roundedStart = Math.round(startMinutes / 15) * 15;
      const roundedEnd = Math.round(endMinutes / 15) * 15;
      
      // Ensure minimum event duration of 15 minutes
      const finalEnd = Math.max(roundedEnd, roundedStart + 15);
      
      console.log(`Calibrated time estimation using ${beforeLabel.element.textContent}: ${minutesToTime(roundedStart)} - ${minutesToTime(finalEnd)} (rounded from ${minutesToTime(startMinutes)} - ${minutesToTime(endMinutes)})`);
      
      return {
        start: roundedStart,
        end: finalEnd
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to estimate time from position:', error);
    return null;
  }
}

// Parse time label like "10 AM" or "2 PM" to minutes since midnight
function parseTimeLabel(timeText) {
  const match = timeText.match(/(\d{1,2})\s*(AM|PM)/i);
  if (!match) return 0;
  
  let hour = parseInt(match[1]);
  const ampm = match[2].toUpperCase();
  
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  
  return hour * 60;
}

// Convert minutes since midnight to time string (e.g., 750 -> "12:30pm")
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
  const displayMins = mins.toString().padStart(2, '0');
  return `${displayHours}:${displayMins}${ampm}`;
}

// Helper function to check if two dates are the same day
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// Check current availability status and update icon color
function checkCurrentAvailability() {
  if (!isOnGoogleCalendar()) return;
  
  try {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    console.log(`🕐 Checking availability at ${now.toLocaleTimeString()} (${currentMinutes} minutes from midnight)`);
    
    // Get calendar events
    const events = getCalendarEvents();
    if (events.length === 0) {
      console.log('📅 No events found, showing available');
      updateIconColor('available');
      return;
    }
    
    // Check for conflicts at current time (look at next 15 minutes)
    const conflict = checkTimeSlotConflicts('10:00am', '10:15am', events);
    
    // For real-time checking, create a time slot for current time
    const currentTime = minutesToTime(currentMinutes);
    const nextSlotTime = minutesToTime(currentMinutes + 15); // Check next 15 minutes
    
    console.log(`🔍 Checking conflict for current time: ${currentTime} - ${nextSlotTime}`);
    
    // Get current week dates to determine which day column to check
    const weekDates = getCurrentWeekDates();
    if (!weekDates || weekDates.length === 0) {
      console.log('❌ No week dates found');
      updateIconColor('available');
      return;
    }
    
    const todayDate = weekDates[currentDay];
    if (!todayDate) {
      console.log('❌ Today date not found in week');
      updateIconColor('available');
      return;
    }
    
    // Check for conflicts right now
    console.log(`\n🔍 CHECKING CONFLICTS for ${todayDate.toDateString()} at ${currentTime}-${nextSlotTime}`);
    const conflicts = getConflictingEvents(todayDate, currentMinutes, currentMinutes + 15, events, 'America/Los_Angeles');
    
    console.log(`\n📊 FINAL CONFLICT RESULT:`);
    console.log(`Found ${conflicts.length} conflict(s)`);
    conflicts.forEach((conflict, i) => {
      console.log(`  ${i}: "${conflict.text}" (${minutesToTime(conflict.start)}-${minutesToTime(conflict.end)})`, conflict.element);
    });
    
    if (conflicts.length > 0) {
      console.log(`🔴 ${conflicts.length} conflict(s) found at current time - showing BUSY`);
      updateIconColor('busy');
    } else {
      console.log('🟢 No conflicts found at current time - showing AVAILABLE');
      updateIconColor('available');
    }
    
  } catch (error) {
    console.error('Error checking current availability:', error);
    updateIconColor('available'); // Default to available on error
  }
}

// Update icon emoji - keep it simple: baby angel when not in use, robot arm when in use
function updateIconColor(status) {
  // Not needed anymore - emoji changes only happen on popup open/close
  return;
}

// Debug Thursday phantom conflict specifically
function debugThursdayPhantom() {
  console.log('\n👻 THURSDAY PHANTOM CONFLICT DEBUGGING:');
  console.log('=======================================');
  
  const thursdayColumn = 4; // Thursday is column 4 (0=Sun, 1=Mon, etc.)
  
  // Get day headers
  const dayHeaders = Array.from(document.querySelectorAll('[role="columnheader"]')).slice(0, 7);
  console.log(`Week headers: ${dayHeaders.length} found`);
  
  if (dayHeaders.length >= 5) {
    const thursdayHeader = dayHeaders[thursdayColumn];
    const thursdayRect = thursdayHeader.getBoundingClientRect();
    
    console.log(`Thursday header: "${thursdayHeader.textContent?.trim()}"`);
    console.log(`Thursday bounds: ${thursdayRect.left.toFixed(0)} - ${thursdayRect.right.toFixed(0)}`);
    
    // Find all elements that overlap with Thursday column
    const thursdayElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const rect = el.getBoundingClientRect();
      const overlapsThursday = rect.left < thursdayRect.right + 10 && rect.right > thursdayRect.left - 10;
      const hasText = el.textContent?.trim().length > 0;
      const reasonableSize = rect.width > 20 && rect.height > 10;
      
      return overlapsThursday && hasText && reasonableSize;
    });
    
    console.log(`Found ${thursdayElements.length} elements in Thursday column`);
    
    // Filter for those that might contain time patterns around 11 AM
    const thursdayTimeElements = thursdayElements.filter(el => {
      const text = el.textContent?.trim();
      return text && (
        /11:00|11am|11 am/i.test(text) ||
        /10:30.*11|11.*11:30/i.test(text) ||
        /\b11\b/i.test(text)
      );
    });
    
    console.log(`Found ${thursdayTimeElements.length} Thursday elements mentioning 11 AM:`);
    thursdayTimeElements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 80)}"`, {
        position: `${rect.left.toFixed(0)},${rect.top.toFixed(0)} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`,
        background: style.backgroundColor,
        color: style.color,
        opacity: style.opacity,
        className: el.className,
        element: el
      });
    });
    
    // Check ALL elements in Thursday column for debugging
    console.log(`\nALL Thursday column elements (first 15):`);
    thursdayElements.slice(0, 15).forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const text = el.textContent?.trim();
      console.log(`  ${i}: "${text?.substring(0, 50)}" (${rect.width.toFixed(0)}x${rect.height.toFixed(0)})`);
    });
    
    // Test what getConflictingEvents finds for Thursday 11 AM
    console.log(`\n🔍 Testing getConflictingEvents for Thursday 11:00-11:15 AM:`);
    const weekDates = getCurrentWeekDates();
    if (weekDates && weekDates[thursdayColumn]) {
      const thursdayDate = weekDates[thursdayColumn];
      console.log(`Thursday date: ${thursdayDate.toDateString()}`);
      
      const events = getCalendarEvents();
      console.log(`Calendar events found: ${events.length}`);
      
      const conflicts = getConflictingEvents(thursdayDate, 11 * 60, 11 * 60 + 15, events, 'America/Los_Angeles');
      console.log(`Conflicts found: ${conflicts.length}`);
      conflicts.forEach((conflict, i) => {
        console.log(`  Conflict ${i}: ${conflict.text} (${minutesToTime(conflict.start)} - ${minutesToTime(conflict.end)})`);
      });
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createClockIcon();
    // Run debug analysis after calendar loads
    if (isOnGoogleCalendar()) {
      setTimeout(debugCalendarDOM, 3000);
      // Debug Thursday phantom after 4 seconds
      setTimeout(debugThursdayPhantom, 4000);
      // Start availability monitoring
      setTimeout(() => {
        checkCurrentAvailability();
        // Check availability every 30 seconds
        setInterval(checkCurrentAvailability, 30000);
      }, 5000); // Wait 5 seconds for calendar to fully load
    }
  });
} else {
  // Only create the icon - no heavy processing until popup is opened
  createClockIcon();
  
  // PERFORMANCE: Removed automatic heavy processing on page load
  // Previously: debugCalendarDOM, debugThursdayPhantom, checkCurrentAvailability
  // These will now only run when popup is opened
}
