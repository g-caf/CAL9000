// Cal 9000 - Simple Calendar Chat Assistant

class CalendarChat {
  constructor() {
    this.token = null;
    this.userEmail = null;
    this.init();
  }

  async init() {
    console.log('🚀 Cal 9000 starting...');
    
    // Check if already authenticated
    await this.checkAuth();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Show appropriate UI
    this.updateUI();
  }

  async checkAuth() {
    try {
      // Check for stored token
      const result = await chrome.storage.local.get(['accessToken', 'userEmail']);
      if (result.accessToken) {
        this.token = result.accessToken;
        this.userEmail = result.userEmail;
        console.log('✅ Found stored token for:', this.userEmail);
        return true;
      }
    } catch (error) {
      console.log('No stored auth found');
    }
    return false;
  }

  setupEventListeners() {
    // Auth button
    document.getElementById('auth-button').addEventListener('click', () => {
      this.authenticate();
    });

    // Send message
    document.getElementById('send-button').addEventListener('click', () => {
      this.sendMessage();
    });

    // Enter key in input
    document.getElementById('message-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  async authenticate() {
    const button = document.getElementById('auth-button');
    button.disabled = true;
    button.textContent = 'Connecting...';
    
    try {
      console.log('🔑 Starting server-side OAuth...');
      
      // Open server auth in popup
      const authPopup = window.open('https://cal9000.onrender.com/auth/google', '_blank', 'width=500,height=600');
      
      if (!authPopup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      console.log('📝 Polling for authentication token...');
      
      // Poll for token
      const token = await new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 150; // 5 minutes max (150 * 2s = 300s)
        
        const checkInterval = setInterval(async () => {
          attempts++;
          
          // Check if popup was closed manually
          if (authPopup.closed) {
            clearInterval(checkInterval);
            reject(new Error('Authentication window was closed'));
            return;
          }
          
          // Timeout after max attempts
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            authPopup.close();
            reject(new Error('Authentication timeout'));
            return;
          }
          
          try {
            console.log(`🔄 Checking for token (attempt ${attempts}/${maxAttempts})...`);
            const response = await fetch('https://cal9000.onrender.com/auth/token', {
              credentials: 'include'
            });
            
            console.log(`📡 Response status: ${response.status}`);
            
            if (response.ok) {
              const data = await response.json();
              console.log('📦 Response data:', data);
              
              if (data.access_token || data.accessToken) {
                console.log('✅ Token received!');
                clearInterval(checkInterval);
                authPopup.close();
                resolve(data);
              } else {
                console.log('⚠️ No access token in response');
              }
            } else {
              const errorText = await response.text();
              console.log(`❌ Error response: ${response.status} - ${errorText}`);
            }
          } catch (error) {
            console.log('⚠️ Token check failed:', error.message);
            // Continue polling on network errors
          }
        }, 2000); // Check every 2 seconds
      });

      console.log('✅ Got OAuth token');
      this.token = token.access_token;

      // Get user info
      const userInfo = await this.getUserInfo(token.access_token);
      this.userEmail = userInfo.email;

      // Store for later
      await chrome.storage.local.set({
        accessToken: token.access_token,
        userEmail: this.userEmail
      });

      console.log('✅ Authentication complete for:', this.userEmail);
      this.updateUI();

    } catch (error) {
      console.error('❌ Authentication failed:', error);
      this.setStatus('Authentication failed. Please try again.', 'error');
      button.disabled = false;
      button.textContent = 'Connect Google Calendar';
    }
  }

  async getUserInfo(token) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await response.json();
  }

  updateUI() {
    const authSection = document.getElementById('auth-section');
    const chatSection = document.getElementById('chat-section');
    
    if (this.token) {
      authSection.classList.add('hidden');
      chatSection.classList.remove('hidden');
      this.setStatus(`Connected as ${this.userEmail}`, 'success');
      document.getElementById('message-input').focus();
    } else {
      authSection.classList.remove('hidden');
      chatSection.classList.add('hidden');
      this.setStatus('Not connected to Google Calendar', 'error');
    }
  }

  async sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Clear input
    input.value = '';
    
    // Add user message to chat
    this.addMessage(message, 'user');
    
    // Disable send button
    const sendButton = document.getElementById('send-button');
    sendButton.disabled = true;
    sendButton.textContent = 'Thinking...';
    
    try {
      // Process the message
      const response = await this.processMessage(message);
      this.addMessage(response, 'assistant');
    } catch (error) {
      console.error('❌ Error processing message:', error);
      this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = 'Send';
      input.focus();
    }
  }

  async processMessage(message) {
    console.log('💭 Processing message:', message);
    
    // Simple keyword detection for now
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('next') || lowerMessage.includes('upcoming')) {
      return await this.getUpcomingEvents();
    } else if (lowerMessage.includes('today')) {
      return await this.getTodayEvents();
    } else if (lowerMessage.includes('tomorrow')) {
      return await this.getTomorrowEvents();
    } else if (lowerMessage.includes('create') || lowerMessage.includes('schedule') || lowerMessage.includes('add')) {
      return "I can see your calendar events, but I can't create new ones yet. That feature is coming soon! 📅";
    } else {
      return await this.getUpcomingEvents();
    }
  }

  async getUpcomingEvents() {
    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // Next 7 days
      
      const events = await this.fetchCalendarEvents(now.toISOString(), endTime.toISOString());
      
      if (events.length === 0) {
        return "🎉 You have no upcoming events in the next week!";
      }
      
      let response = `📅 Here are your upcoming events:\n\n`;
      events.slice(0, 5).forEach((event, index) => {
        const start = new Date(event.start.dateTime || event.start.date);
        const timeStr = event.start.dateTime ? 
          start.toLocaleString() : 
          start.toLocaleDateString();
        response += `${index + 1}. **${event.summary}**\n   ${timeStr}\n\n`;
      });
      
      if (events.length > 5) {
        response += `...and ${events.length - 5} more events`;
      }
      
      return response;
    } catch (error) {
      console.error('❌ Error fetching events:', error);
      return "Sorry, I couldn't fetch your calendar events. Please try again.";
    }
  }

  async getTodayEvents() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const events = await this.fetchCalendarEvents(today.toISOString(), tomorrow.toISOString());
      
      if (events.length === 0) {
        return "📅 You have no events scheduled for today!";
      }
      
      let response = `📅 Today's events:\n\n`;
      events.forEach((event, index) => {
        const start = new Date(event.start.dateTime || event.start.date);
        const timeStr = event.start.dateTime ? 
          start.toLocaleTimeString() : 
          'All day';
        response += `${index + 1}. **${event.summary}**\n   ${timeStr}\n\n`;
      });
      
      return response;
    } catch (error) {
      return "Sorry, I couldn't fetch today's events. Please try again.";
    }
  }

  async getTomorrowEvents() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);
      
      const events = await this.fetchCalendarEvents(tomorrow.toISOString(), dayAfter.toISOString());
      
      if (events.length === 0) {
        return "📅 You have no events scheduled for tomorrow!";
      }
      
      let response = `📅 Tomorrow's events:\n\n`;
      events.forEach((event, index) => {
        const start = new Date(event.start.dateTime || event.start.date);
        const timeStr = event.start.dateTime ? 
          start.toLocaleTimeString() : 
          'All day';
        response += `${index + 1}. **${event.summary}**\n   ${timeStr}\n\n`;
      });
      
      return response;
    } catch (error) {
      return "Sorry, I couldn't fetch tomorrow's events. Please try again.";
    }
  }

  async fetchCalendarEvents(timeMin, timeMax) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=20`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.items || [];
  }

  addMessage(text, sender) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    // Simple markdown-like formatting
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    messageDiv.innerHTML = formattedText.replace(/\n/g, '<br>');
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  setStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = 'status';
    }, 3000);
  }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new CalendarChat();
});
