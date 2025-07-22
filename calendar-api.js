// Google Calendar API service layer
class CalendarAPI {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
    this.loadStoredToken();
  }

  // Load token from localStorage
  loadStoredToken() {
    try {
      const stored = localStorage.getItem('calendar_api_token');
      const expiry = localStorage.getItem('calendar_api_expiry');
      
      if (stored && expiry && new Date().getTime() < parseInt(expiry)) {
        this.accessToken = stored;
        this.isAuthenticated = true;
        console.log('✅ Loaded valid token from storage');
        return true;
      } else if (stored) {
        // Token expired, clear it
        localStorage.removeItem('calendar_api_token');
        localStorage.removeItem('calendar_api_expiry');
        console.log('🕒 Stored token expired, cleared');
      }
    } catch (error) {
      console.error('Error loading stored token:', error);
    }
    return false;
  }

  // Store token with expiry
  storeToken(token) {
    try {
      const expiry = new Date().getTime() + (50 * 60 * 1000); // 50 minutes (safe margin)
      localStorage.setItem('calendar_api_token', token);
      localStorage.setItem('calendar_api_expiry', expiry.toString());
      console.log('💾 Token stored with expiry');
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  // Authenticate with Google Calendar API using popup window
  async authenticate() {
    return new Promise((resolve, reject) => {
      if (this.isAuthenticated && this.accessToken) {
        resolve(this.accessToken);
        return;
      }

      // Try chrome.identity.launchWebAuthFlow first (proper Chrome extension method)
      if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.launchWebAuthFlow) {
        this.authenticateWithWebAuthFlow().then(resolve).catch((error) => {
          console.error('WebAuthFlow failed:', error);
          // Fallback to manual method
          console.log('🔄 Falling back to manual authentication');
          this.authenticateWithPopup().then(resolve).catch(reject);
        });
      } else {
        // Fallback to manual authentication for development
        console.log('🔄 Using manual authentication');
        this.authenticateWithPopup().then(resolve).catch(reject);
      }
    });
  }

  // Chrome extension web auth flow (proper method)
  async authenticateWithWebAuthFlow() {
    return new Promise((resolve, reject) => {
      const clientId = '527047051561-fcdkkdg4i89d7njf8o1f9q2j2dqeg9q8.apps.googleusercontent.com';
      const redirectUri = chrome.identity.getRedirectURL();
      const scope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar';
      
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `response_type=token&` +
        `include_granted_scopes=true`;

      console.log('🔑 Starting Chrome extension OAuth flow...');
      console.log('Redirect URI:', redirectUri);

      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            console.error('WebAuthFlow error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          if (!responseUrl) {
            reject(new Error('No response URL received'));
            return;
          }

          // Extract token from response URL
          const url = new URL(responseUrl);
          const params = new URLSearchParams(url.hash.substring(1));
          const token = params.get('access_token');

          if (token) {
            this.accessToken = token;
            this.isAuthenticated = true;
            this.storeToken(token);
            console.log('✅ Authenticated with Google Calendar API via WebAuthFlow');
            resolve(token);
          } else {
            reject(new Error('No access token in response'));
          }
        }
      );
    });
  }

  // Manual token authentication using OAuth Playground
  async authenticateWithPopup() {
    return new Promise((resolve, reject) => {
      const clientId = '527047051561-fcdkkdg4i89d7njf8o1f9q2j2dqeg9q8.apps.googleusercontent.com';
      const scope = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar';
      
      // Create instructions modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
      `;

      content.innerHTML = `
        <h3 style="margin-top: 0;">Connect to Google Calendar</h3>
        <ol style="font-size: 14px; line-height: 1.5;">
          <li>Click the link below to open Google OAuth Playground</li>
          <li>On the left, find "Calendar API v3" and check both boxes</li>
          <li>Click "Authorize APIs"</li>
          <li>Sign in and grant permissions</li>
          <li>Click "Exchange authorization code for tokens"</li>
          <li>Copy the "Access token" and paste it below</li>
        </ol>
        <p><a href="https://developers.google.com/oauthplayground/" target="_blank" style="color: #4285f4;">
          → Open OAuth Playground
        </a></p>
        <div style="margin: 15px 0;">
          <label style="display: block; margin-bottom: 5px; font-weight: 500;">Access Token:</label>
          <input type="text" id="manual-token" placeholder="Paste access token here..." 
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px;">
          <button id="cancel-auth" style="padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">
            Cancel
          </button>
          <button id="submit-token" style="padding: 8px 16px; border: none; background: #4285f4; color: white; border-radius: 4px; cursor: pointer;">
            Connect
          </button>
        </div>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);

      // Handle form submission
      const submitBtn = content.querySelector('#submit-token');
      const cancelBtn = content.querySelector('#cancel-auth');
      const tokenInput = content.querySelector('#manual-token');

      submitBtn.addEventListener('click', () => {
        const token = tokenInput.value.trim();
        if (token) {
          this.accessToken = token;
          this.isAuthenticated = true;
          this.storeToken(token); // Store for later use
          document.body.removeChild(modal);
          console.log('✅ Authenticated with Google Calendar API via manual token');
          resolve(token);
        } else {
          alert('Please enter an access token');
        }
      });

      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        reject(new Error('Authentication cancelled'));
      });

      // Focus the input
      setTimeout(() => tokenInput.focus(), 100);
    });
  }

  // Get calendar events for a date range
  async getEvents(startDate, endDate, calendarId = 'primary') {
    try {
      await this.authenticate();

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events` +
        `?timeMin=${encodeURIComponent(startISO)}` +
        `&timeMax=${encodeURIComponent(endISO)}` +
        `&singleEvents=true` +
        `&orderBy=startTime` +
        `&maxResults=2500`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Calendar API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📅 Fetched ${data.items?.length || 0} events from ${startISO} to ${endISO}`);
      
      return this.processEvents(data.items || []);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  // Process raw events into our format
  processEvents(rawEvents) {
    return rawEvents.map(event => {
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      const isAllDay = !event.start?.dateTime; // All-day events don't have dateTime

      return {
        id: event.id,
        title: event.summary || 'Untitled Event',
        start: new Date(startTime),
        end: new Date(endTime),
        isAllDay: isAllDay,
        description: event.description || '',
        location: event.location || '',
        status: event.status,
        transparency: event.transparency, // 'opaque' (busy) or 'transparent' (free)
        visibility: event.visibility,
        raw: event
      };
    }).filter(event => {
      // Filter out events we should ignore for conflict detection
      const duration = event.end.getTime() - event.start.getTime();
      const hoursLong = duration / (1000 * 60 * 60);
      
      // Skip all-day events and events longer than 8 hours (OOO, conferences, etc.)
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
      // Check for time overlap
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
      await this.authenticate();

      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create event: ${response.status} ${response.statusText}`);
      }

      const event = await response.json();
      console.log('✅ Created calendar event:', event.summary);
      return event;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  // Get all user's calendars
  async getCalendars() {
    try {
      await this.authenticate();

      const url = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error fetching calendars:', error);
      throw error;
    }
  }

  // Clear authentication (for debugging/logout)
  clearAuth() {
    if (this.accessToken) {
      chrome.identity.removeCachedAuthToken({ token: this.accessToken });
    }
    this.accessToken = null;
    this.isAuthenticated = false;
    console.log('🔓 Cleared authentication');
  }
}

// Create global instance
window.calendarAPI = new CalendarAPI();

// Export for use in content scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarAPI;
}
