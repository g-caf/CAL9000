// Simple extension client for backend-heavy OAuth
let currentSessionId = null;
let pollInterval = null;
let lastQueriedPerson = null; // Track the last person asked about for context

document.addEventListener('DOMContentLoaded', async () => {
  console.log('CAL 9000 Extension loaded - v1.1');
  
  // Check if already authenticated
  const savedToken = await chrome.storage.local.get(['accessToken']);
  if (savedToken.accessToken) {
    console.log('Found saved token');
    await showAuthenticatedUI();
  } else {
    showUnauthenticatedUI();
  }
});

function showUnauthenticatedUI() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('chat-section').classList.add('hidden');
  
  document.getElementById('auth-button').onclick = startAuthentication;
}

async function showAuthenticatedUI() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('chat-section').classList.remove('hidden');
  
  // Set up chat functionality
  document.getElementById('send-button').onclick = sendMessage;
  document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // Silently discover calendars when authenticated
  try {
    await discoverCalendars(false, true); // showDetails=false, silent=true
  } catch (error) {
    console.error('Failed to auto-discover calendars:', error);
    // Fail silently - user can manually discover calendars if needed
  }
}

async function startAuthentication() {
  console.log('Starting authentication...');
  
  // Generate cryptographically secure session ID
  currentSessionId = 'ext_' + crypto.randomUUID();
  console.log('Generated session ID:', currentSessionId);
  
  // Update UI
  const authBtn = document.getElementById('auth-button');
  authBtn.textContent = 'Authenticating...';
  authBtn.disabled = true;
  
  // Open OAuth URL with session ID
  const authURL = `https://cal9000.onrender.com/auth/google?sessionId=${currentSessionId}`;
  console.log('Opening auth URL:', authURL);
  
  try {
    // Open popup window for OAuth
    chrome.windows.create({
      url: authURL,
      type: 'popup',
      width: 500,
      height: 600,
      left: Math.round((screen.width - 500) / 2),
      top: Math.round((screen.height - 600) / 2)
    }, (window) => {
      console.log('OAuth popup opened:', window.id);
      
      // Start polling for auth result
      startPolling();
      
      // Listen for window closure
      chrome.windows.onRemoved.addListener(function windowClosedListener(windowId) {
        if (windowId === window.id) {
          console.log('OAuth popup closed');
          chrome.windows.onRemoved.removeListener(windowClosedListener);
          
          // Continue polling for a bit in case user manually closed
          setTimeout(() => {
            if (pollInterval) {
              console.log('Stopping polling due to popup closure');
              stopPolling();
              resetAuthButton();
            }
          }, 5000);
        }
      });
    });
  } catch (error) {
    console.error('Error opening auth popup:', error);
    resetAuthButton();
  }
}

function startPolling() {
  console.log('Starting auth status polling...');
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(async () => {
      console.log(`Polling for session:`, currentSessionId);
      
      try {
        const response = await fetch(`https://cal9000.onrender.com/auth/status/${currentSessionId}`, {
          credentials: 'include'  // Important for some servers
        });
        
        console.log('📨 Poll response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Poll data:', data);
          
          // Check for access_token (common format) or accessToken
          if (data.access_token || data.accessToken) {
            console.log('Authentication successful!');
            clearInterval(checkInterval);
            
            // Save token to extension storage with expiration time
            const expiresAt = Date.now() + (3600 * 1000); // 1 hour from now
            await chrome.storage.local.set({ 
              accessToken: data.access_token || data.accessToken,
              refreshToken: data.refresh_token || data.refreshToken,
              user: data.user,
              authenticated: true,
              tokenExpiresAt: expiresAt
            });
            
            // Update UI immediately
            await showAuthenticatedUI();
            resolve(true);
          } else if (data.status === 'error') {
            console.error('Authentication error:', data.error);
            clearInterval(checkInterval);
            alert('Authentication failed: ' + data.error);
            resetAuthButton();
            resolve(false);
          }
          // Continue polling if status is 'pending'
        } else {
          console.log('Non-OK response, continuing to poll...');
        }
        
      } catch (error) {
        console.error('Polling error:', error);
        // Continue polling on network errors
      }
    }, 2000); // Poll every 2 seconds
    
    // Timeout after 2 minutes
    setTimeout(() => {
      console.log('Polling timeout');
      clearInterval(checkInterval);
      alert('Authentication timed out. Please try again.');
      resetAuthButton();
      resolve(false);
    }, 120000);
  });
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('Stopped polling');
  }
}

function resetAuthButton() {
  const authBtn = document.getElementById('auth-button');
  authBtn.textContent = 'Connect Google Calendar';
  authBtn.disabled = false;
  currentSessionId = null;
}

async function logout() {
  console.log('Logging out...');
  
  // Clear stored tokens
  await chrome.storage.local.clear();
  
  // Reset UI
  showUnauthenticatedUI();
}

// Token refresh functionality
async function refreshAccessToken() {
  console.log('🔄 Refreshing access token...');
  
  try {
    const stored = await chrome.storage.local.get(['refreshToken']);
    if (!stored.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await fetch('https://cal9000.onrender.com/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken: stored.refreshToken
      })
    });
    
    if (!response.ok) {
      throw new Error(`Refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Update stored tokens
    const expiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
    await chrome.storage.local.set({
      accessToken: data.access_token,
      tokenExpiresAt: expiresAt
    });
    
    console.log('✅ Token refreshed successfully');
    return data.access_token;
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    // If refresh fails, user needs to re-authenticate
    await chrome.storage.local.clear();
    showUnauthenticatedUI();
    throw error;
  }
}

// Check if token needs refresh and refresh if necessary
async function ensureValidToken() {
  const stored = await chrome.storage.local.get(['accessToken', 'tokenExpiresAt', 'refreshToken']);
  
  if (!stored.accessToken || !stored.refreshToken) {
    throw new Error('No valid tokens available');
  }
  
  // Check if token expires within 5 minutes
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
  if (stored.tokenExpiresAt && stored.tokenExpiresAt < fiveMinutesFromNow) {
    console.log('🔄 Token expires soon, refreshing...');
    return await refreshAccessToken();
  }
  
  return stored.accessToken;
}

// Enhanced API call function with automatic token refresh
async function makeAuthorizedRequest(url, options = {}) {
  try {
    const token = await ensureValidToken();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    
    // If we get 401, try to refresh and retry once
    if (response.status === 401) {
      console.log('🔄 Got 401, refreshing token and retrying...');
      const newToken = await refreshAccessToken();
      
      return await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`
        }
      });
    }
    
    return response;
    
  } catch (error) {
    console.error('❌ Authorized request failed:', error);
    throw error;
  }
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Add user message to chat
  addMessage(message, 'user');
  input.value = '';
  
  try {
    // Show typing indicator
    addMessage('Thinking...', 'assistant');
    
    // Check for special commands
    if (message.toLowerCase().includes('calendars') || message.toLowerCase().includes('list calendars')) {
      await discoverCalendars(true); // Show details when manually requested
    } else {
      // Parse the query for person-specific requests or AI analysis
      await handleCalendarQuery(message);
    }
    
  } catch (error) {
    console.error('Error sending message:', error);
    addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
  }
}

function addMessage(text, sender) {
  const messagesContainer = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  // Check if this is AI-generated content with safe HTML formatting
  if (sender === 'assistant' && text.includes('<span style=')) {
    // Safely render AI-generated HTML with allowed styling
    messageDiv.innerHTML = sanitizeAIHTML(text);
  } else {
    // Safely handle plain text without innerHTML (prevents XSS)
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (index > 0) {
        messageDiv.appendChild(document.createElement('br'));
      }
      messageDiv.appendChild(document.createTextNode(line));
    });
  }
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sanitizeAIHTML(html) {
  // Only allow safe HTML tags and inline styling for calendar formatting
  const allowedTags = ['span', 'strong', 'em', 'br'];
  const allowedStyles = ['background-color', 'color', 'padding', 'border-radius', 'font-weight'];
  
  // Simple sanitization - only allow span tags with specific inline styles
  return html
    .replace(/<(?!\/?(span|strong|em|br)\b)[^>]+>/gi, '') // Remove disallowed tags
    .replace(/style="([^"]*)"/, (match, styles) => {
      // Filter styles to only allow safe CSS properties
      const safeSyles = styles.split(';')
        .filter(style => {
          const prop = style.split(':')[0]?.trim();
          return allowedStyles.includes(prop);
        })
        .join(';');
      return `style="${safeSyles}"`;
    });
}

async function discoverCalendars(showDetails = false, silent = false) {
  try {
    console.log('Discovering calendars...');
    
    const response = await makeAuthorizedRequest(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList'
    );
    
    console.log('Calendar list response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar list error:', response.status, errorText);
      throw new Error(`Calendar list API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Calendar list data:', data);
    
    // Remove the "Thinking..." message only if not silent
    if (!silent) {
      removeThinkingMessage();
    }
    
    if (data.items && data.items.length > 0) {
      // Store calendar list for future use
      await chrome.storage.local.set({ calendars: data.items });
      console.log('Stored calendar list for future reference');
      
      if (!silent) {
        if (showDetails) {
          const calendarsList = data.items.map(calendar => {
            const name = calendar.summary || 'Unnamed Calendar';
            const owner = calendar.id;
            const access = calendar.accessRole || 'unknown';
            const isPrimary = calendar.primary ? ' (PRIMARY)' : '';
            const description = calendar.description ? ` - ${calendar.description}` : '';
            
            return `• **${name}**${isPrimary}\n  📧 ${owner}\n  Access: ${access}${description}`;
          }).join('\n\n');
          
          addMessage(`I found ${data.items.length} calendars you have access to:\n\n${calendarsList}`, 'assistant');
        } else {
          // Just a simple confirmation for auto-discovery
          const availableNames = getAvailablePersonNames(data.items);
          addMessage(`Ready! I can access calendars for: ${availableNames.join(', ')}. Ask me about your schedule!`, 'assistant');
        }
      }
      
    } else {
      if (!silent) {
        addMessage('No calendars found.', 'assistant');
      }
    }
    
  } catch (error) {
    console.error('Error discovering calendars:', error);
    if (!silent) {
      removeThinkingMessage();
      addMessage(`Sorry, I couldn't discover your calendars. Error: ${error.message}`, 'assistant');
    }
  }
}

function removeThinkingMessage() {
  const messages = document.getElementById('messages');
  const lastMessage = messages.lastElementChild;
  if (lastMessage && lastMessage.textContent === 'Thinking...') {
    lastMessage.remove();
  }
}

async function handleCalendarQuery(message) {
  console.log('Handling calendar query:', message);
  
  // Parse person names and dates from the message or trigger AI analysis
  const queryInfo = await parseCalendarQuery(message);
  console.log('Parsed query:', queryInfo);
  
  // Handle AI analysis results
  if (queryInfo.isIntelligentQuery) {
    await handleIntelligentAnalysis(queryInfo);
    return;
  }
  
  // Route to availability calculation if needed
  if (queryInfo.needsAvailabilityCalculation || queryInfo.isAvailabilityCheck) {
    console.log('Availability calculation needed');
    addMessage(`Finding available time slots...`, 'assistant');
    await calculateAndDisplayAvailability(queryInfo, message);
    return;
  }
  
  // Traditional query handling
  if (queryInfo.person) {
    console.log('Found person:', queryInfo.person);
    
    // Store for context in future queries
    lastQueriedPerson = queryInfo.person;
    
    // Check if this is a scheduling request (finding available time slots)
    if (queryInfo.isSchedulingRequest) {
      console.log('Scheduling request detected');
      addMessage(`Finding available time slots for ${queryInfo.meetingDuration} meeting with ${queryInfo.person}...`, 'assistant');
      await findAvailableTimeSlots(queryInfo);
    } else if (queryInfo.isCompanyMeetingQuery) {
      console.log('Meeting with person/company query detected');
      addMessage(`Looking for ${queryInfo.person}'s meetings with ${queryInfo.companyName}...`, 'assistant');
      await findMeetingWith(queryInfo);
    } else if (queryInfo.isSpecificEventQuery) {
      console.log('Specific event query detected');
      addMessage(`Looking for ${queryInfo.person}'s ${queryInfo.eventType}...`, 'assistant');
      await findSpecificEvent(queryInfo);
    } else {
      addMessage(`Looking for ${queryInfo.person}'s calendar...`, 'assistant');
      // Get specific person's calendar
      await getPersonCalendarEvents(queryInfo);
    }
  } else {
    console.log('No person found, using default calendar');
    addMessage(`No specific person mentioned, showing your calendar...`, 'assistant');
    // Default to user's own calendar
    await getCalendarEvents(message);
  }
}

/**
 * Handle AI intelligent analysis results
 */
async function handleIntelligentAnalysis(queryInfo) {
  console.log('Handling intelligent analysis:', queryInfo.analysisType);
  
  removeThinkingMessage();
  
  const { analysisType, intelligenceResult } = queryInfo;
  
  try {
    switch (analysisType) {
      case 'conflict_resolution':
        await displayConflictResolution(intelligenceResult);
        break;
        
      case 'pattern_recognition':
        await displayPatternAnalysis(intelligenceResult);
        break;
        
      case 'availability_optimization':
        await displayAvailabilityOptimization(intelligenceResult);
        break;
        
      case 'multi_person_scheduling':
        await displayMultiPersonScheduling(intelligenceResult);
        break;
        
      case 'meeting_intelligence':
        await displayMeetingIntelligence(intelligenceResult);
        break;
        
      case 'focus_time_analysis':
        await displayFocusTimeAnalysis(intelligenceResult);
        break;
        
      default:
        addMessage(`AI Analysis complete for ${analysisType}:\n\n${JSON.stringify(intelligenceResult, null, 2)}`, 'assistant');
    }
  } catch (error) {
    console.error('Error displaying intelligent analysis:', error);
    addMessage(`I completed the AI analysis but had trouble displaying the results. Error: ${error.message}`, 'assistant');
  }
}

/**
 * Display conflict resolution results
 */
async function displayConflictResolution(result) {
  if (result.recommendedTimes && result.recommendedTimes.length > 0) {
    const timesList = result.recommendedTimes.map((rec, index) => 
      `${index + 1}. **${rec.timeSlot}** (${rec.confidence} confidence)\n   ${rec.reasoning}`
    ).join('\n\n');
    
    let message = `🎯 **Smart Scheduling Recommendations:**\n\n${timesList}`;
    
    if (result.conflictAnalysis) {
      message += `\n\n📊 **Schedule Analysis:**`;
      if (result.conflictAnalysis.busyPeriods?.length > 0) {
        message += `\n• Busy periods: ${result.conflictAnalysis.busyPeriods.join(', ')}`;
      }
      if (result.conflictAnalysis.optimalDayPattern) {
        message += `\n• ${result.conflictAnalysis.optimalDayPattern}`;
      }
    }
    
    if (result.schedulingInsights?.length > 0) {
      message += `\n\n💡 **Insights:**\n${result.schedulingInsights.map(insight => `• ${insight}`).join('\n')}`;
    }
    
    addMessage(message, 'assistant');
  } else {
    addMessage('I analyzed your calendar but couldn\'t find optimal meeting times with the current constraints. Try adjusting the time range or duration.', 'assistant');
  }
}

/**
 * Display pattern analysis results
 */
async function displayPatternAnalysis(result) {
  let message = `📈 **Calendar Pattern Analysis:**\n\n`;
  
  if (result.patterns) {
    if (result.patterns.preferredDays?.length > 0) {
      message += `📅 **Meeting Days:** ${result.patterns.preferredDays.join(', ')}\n`;
    }
    if (result.patterns.preferredTimes?.length > 0) {
      message += `⏰ **Preferred Times:** ${result.patterns.preferredTimes.join(', ')}\n`;
    }
    if (result.patterns.meetingDurations?.length > 0) {
      message += `⏱️ **Common Durations:** ${result.patterns.meetingDurations.join(', ')}\n`;
    }
    if (result.patterns.backToBackTrends) {
      message += `🔄 **Back-to-back Pattern:** ${result.patterns.backToBackTrends}\n`;
    }
  }
  
  if (result.efficiency) {
    message += `\n⚡ **Efficiency Score:** ${result.efficiency.score}/10\n`;
    if (result.efficiency.areas_for_improvement?.length > 0) {
      message += `🎯 **Areas to Improve:** ${result.efficiency.areas_for_improvement.join(', ')}\n`;
    }
  }
  
  if (result.recommendations?.length > 0) {
    message += `\n💡 **Recommendations:**\n${result.recommendations.map(rec => `• ${rec}`).join('\n')}`;
  }
  
  addMessage(message, 'assistant');
}

/**
 * Display availability optimization results
 */
async function displayAvailabilityOptimization(result) {
  let message = `🎯 **Calendar Optimization Suggestions:**\n\n`;
  
  if (result.focusTimeBlocks?.length > 0) {
    message += `🧠 **Focus Time Opportunities:**\n`;
    result.focusTimeBlocks.forEach((block, index) => {
      message += `${index + 1}. **${block.timeSlot}** (${block.duration} min) - ${block.quality} quality\n   ${block.reasoning}\n`;
    });
    message += '\n';
  }
  
  if (result.bufferSuggestions?.length > 0) {
    message += `⏸️ **Buffer Time Suggestions:**\n`;
    result.bufferSuggestions.forEach(suggestion => {
      message += `• ${suggestion.recommendation} - ${suggestion.benefit}\n`;
    });
    message += '\n';
  }
  
  if (result.availabilityScore) {
    message += `📊 **Availability Score:** ${result.availabilityScore.current}/10 → ${result.availabilityScore.potential}/10\n`;
    if (result.availabilityScore.improvements?.length > 0) {
      message += `🎯 **Key Improvements:** ${result.availabilityScore.improvements.join(', ')}\n`;
    }
  }
  
  if (result.consolidationOpportunities?.length > 0) {
    message += `\n📋 **Meeting Consolidation:**\n${result.consolidationOpportunities.map(opp => `• ${opp}`).join('\n')}`;
  }
  
  addMessage(message, 'assistant');
}

/**
 * Calculate and display availability slots
 */
async function calculateAndDisplayAvailability(queryInfo, originalMessage) {
  try {
    // Get calendar events for the specified time range
    const calendarEvents = await fetchCalendarEventsForAvailability(queryInfo);
    
    // Call backend intelligent analysis for availability calculation
    const response = await fetch(`${BASE_URL}/api/nlp/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        message: originalMessage,
        calendarEvents: calendarEvents,
        forceIntelligentAnalysis: true,
        analysisType: 'conflict_resolution' // This finds optimal meeting times = available slots
      })
    });

    if (!response.ok) {
      throw new Error(`Availability analysis failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('Availability analysis result:', result);

    if (result.success && result.result.recommendedTimes) {
      await displayAvailabilitySlots(result.result, queryInfo);
    } else {
      addMessage('I couldn\'t find suitable time slots with your current constraints. Try adjusting the time range or duration.', 'assistant');
    }

  } catch (error) {
    console.error('Availability calculation error:', error);
    addMessage(`Sorry, I couldn't calculate availability: ${error.message}`, 'assistant');
  }
}

/**
 * Fetch calendar events specifically for availability calculation
 */
async function fetchCalendarEventsForAvailability(queryInfo) {
  const calendarId = getCalendarIdForPerson(queryInfo.person || 'adrienne');
  const { timeMin, timeMax } = queryInfo.dateRange;
  
  const response = await makeAuthorizedRequest(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
    `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch calendar events: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Display available time slots
 */
async function displayAvailabilitySlots(analysisResult, queryInfo) {
  let message = `🗓️ **Available Time Slots:**\n\n`;
  
  if (analysisResult.recommendedTimes && analysisResult.recommendedTimes.length > 0) {
    analysisResult.recommendedTimes.forEach((slot, index) => {
      message += `${index + 1}. **${slot.timeSlot}**\n`;
      message += `   Confidence: ${slot.confidence}\n`;
      if (slot.reasoning) {
        message += `   ${slot.reasoning}\n`;
      }
      message += '\n';
    });
    
    if (queryInfo.meetingDuration) {
      message += `💡 **Duration requested:** ${queryInfo.meetingDuration}\n\n`;
    }
    
    if (analysisResult.schedulingInsights && analysisResult.schedulingInsights.length > 0) {
      message += `📋 **Scheduling Insights:**\n`;
      analysisResult.schedulingInsights.forEach(insight => {
        message += `• ${insight}\n`;
      });
    }
  } else {
    message = `No available time slots found for the requested criteria. Try:\n• Expanding the time range\n• Reducing meeting duration\n• Checking a different day`;
  }
  
  addMessage(message, 'assistant');
}

/**
 * Display focus time analysis results
 */
async function displayFocusTimeAnalysis(result) {
  let message = `🧠 **Focus Time Analysis:**\n\n`;
  
  if (result.focusOpportunities?.length > 0) {
    message += `⏰ **Focus Time Opportunities:**\n`;
    result.focusOpportunities.forEach((opp, index) => {
      message += `${index + 1}. **${opp.timeBlock}** (${opp.duration} min)\n`;
      message += `   Quality: ${opp.quality} | Energy: ${opp.energyLevel} | Interruption Risk: ${opp.interruptionRisk}\n`;
      if (opp.recommendations?.length > 0) {
        message += `   Tips: ${opp.recommendations.join(', ')}\n`;
      }
      message += '\n';
    });
  }
  
  if (result.calendarAdjustments?.length > 0) {
    message += `🎯 **Calendar Adjustments:**\n${result.calendarAdjustments.map(adj => `• ${adj}`).join('\n')}\n\n`;
  }
  
  if (result.productivityInsights?.length > 0) {
    message += `⚡ **Productivity Insights:**\n${result.productivityInsights.map(insight => `• ${insight}`).join('\n')}`;
  }
  
  addMessage(message, 'assistant');
}

async function parseCalendarQuery(message) {
  console.log('Parsing message with intelligent routing:', message);
  
  try {
    // First, get calendar events for intelligent analysis
    const calendarEvents = await getCurrentCalendarEvents();
    
    // Call intelligent query routing
    const response = await fetch('https://cal9000.onrender.com/api/nlp/route', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-ID': chrome.runtime.id
      },
      body: JSON.stringify({ 
        message,
        calendarEvents: calendarEvents || []
      })
    });
    
    if (!response.ok) {
      throw new Error(`Intelligent routing API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Intelligent routing result:', result);
    
    // Handle different result types
    if (result.routing.type === 'intelligence') {
      return convertIntelligenceResultToQueryInfo(result.result, message, result.routing);
    } else {
      // Traditional parsing result
      return convertLLMResultToQueryInfo(result.result, message);
    }
    
  } catch (error) {
    console.error('Intelligent parsing failed, using fallback:', error);
    return fallbackParseCalendarQuery(message);
  }
}

/**
 * Get current calendar events for analysis
 */
async function getCurrentCalendarEvents() {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const response = await makeAuthorizedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `maxResults=500&singleEvents=true&orderBy=startTime&` +
      `timeMin=${weekAgo.toISOString()}&timeMax=${monthFromNow.toISOString()}`
    );
    
    if (!response.ok) {
      console.log('Could not fetch calendar events for analysis');
      return null;
    }
    
    const data = await response.json();
    return data.items || [];
    
  } catch (error) {
    console.error('Error fetching calendar events for analysis:', error);
    return null;
  }
}

/**
 * Convert AI intelligence result to query info format
 */
function convertIntelligenceResultToQueryInfo(intelligenceResult, originalMessage, routing) {
  // This creates a special query info object that indicates AI analysis was used
  return {
    intent: 'ai_analysis',
    analysisType: routing.analysisType,
    intelligenceResult: intelligenceResult,
    originalMessage: originalMessage,
    isIntelligentQuery: true,
    person: extractPersonFromMessage(originalMessage),
    dateRange: determineDateRangeFromOptions(routing.options)
  };
}

function convertLLMResultToQueryInfo(llmResult, originalMessage) {
  // Convert LLM result to our internal format
  let dateRange = null;
  
  // Parse date range
  if (llmResult.dateRange) {
    switch (llmResult.dateRange.toLowerCase()) {
      case 'today':
        dateRange = getTodayRange();
        break;
      case 'tomorrow':
        dateRange = getTomorrowRange();
        break;
      case 'next week':
        dateRange = getNextWeekRange();
        break;
      case 'this week':
        dateRange = getThisWeekRange();
        break;
      default:
        // Try to parse specific dates
        dateRange = parseSpecificDate(llmResult.dateRange) || getNext30DaysRange();
    }
  }
  
  // Default date range if none specified
  if (!dateRange) {
    dateRange = getThisWeekRange(); // Default for all queries when no date specified
  }
  
  return {
    person: llmResult.person,
    dateRange,
    isAvailabilityCheck: llmResult.intent === 'find_availability',
    needsAvailabilityCalculation: llmResult.needsAvailabilityCalculation || false,
    isSpecificEventQuery: llmResult.intent === 'show_events' && llmResult.meetingType,
    isCompanyMeetingQuery: !!llmResult.companyName || llmResult.intent === 'show_events',
    isNextMeetingQuery: originalMessage.toLowerCase().includes('next meeting'),
    isSchedulingRequest: llmResult.intent === 'schedule_meeting',
    meetingDuration: llmResult.duration,
    companyName: llmResult.companyName,
    eventType: llmResult.meetingType,
    specificTime: null, // Can enhance later
    timezone: null // Can enhance later
  };
}

function fallbackParseCalendarQuery(message) {
  console.log('Using simple fallback parsing for:', message);
  
  const lowerMessage = message.toLowerCase();
  
  // Simple pattern matching for critical cases
  let person = null;
  let isSchedulingRequest = false;
  let meetingDuration = null;
  let isAvailabilityCheck = false;
  
  // Check for scheduling
  if (lowerMessage.includes('looking for') && lowerMessage.includes('minutes')) {
    isSchedulingRequest = true;
    const durationMatch = lowerMessage.match(/(\d+)\s+(minute|hour)s?/);
    if (durationMatch) {
      meetingDuration = `${durationMatch[1]} ${durationMatch[2]}`;
    }
  }
  
  // Check for availability
  if (lowerMessage.includes('free') || lowerMessage.includes('available')) {
    isAvailabilityCheck = true;
  }
  
  // Extract person names
  if (lowerMessage.includes('quinn') || lowerMessage.includes('sqs')) {
    person = 'sqs';
  } else if (lowerMessage.includes('my') || lowerMessage.includes('me') || lowerMessage.includes('i ')) {
    person = 'adrienne';
  }
  
  // Default date range
  let dateRange = getThisWeekRange();
  if (lowerMessage.includes('tomorrow')) {
    dateRange = getTomorrowRange();
  } else if (lowerMessage.includes('next week')) {
    dateRange = getNextWeekRange();
  } else if (person || isSchedulingRequest) {
    dateRange = getNext30DaysRange();
  }
  
  return {
    person,
    dateRange,
    isAvailabilityCheck,
    isSpecificEventQuery: false,
    isCompanyMeetingQuery: false,
    isNextMeetingQuery: lowerMessage.includes('next meeting'),
    isSchedulingRequest,
    meetingDuration,
    companyName: null,
    eventType: null,
    specificTime: null,
    timezone: null
  };
}

function getTomorrowRange() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getTodayRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getNext30DaysRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return { start, end };
}

function getThisWeekRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function getNextWeekRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() + 7); // Start of next week
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function parseRelativeDay(modifier, dayName) {
  console.log('Parsing relative day:', modifier, dayName);
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayIndex = dayNames.indexOf(dayName.toLowerCase());
  
  if (targetDayIndex === -1) {
    console.error('Invalid day name:', dayName);
    return null;
  }
  
  const today = new Date();
  const currentDayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  let targetDate = new Date(today);
  
  if (modifier === 'this') {
    // "this Thursday" logic
    if (targetDayIndex >= currentDayIndex) {
      // Target day is today or later this week
      const daysToAdd = targetDayIndex - currentDayIndex;
      targetDate.setDate(today.getDate() + daysToAdd);
    } else {
      // Target day has passed this week, so next week
      const daysToAdd = (7 - currentDayIndex) + targetDayIndex;
      targetDate.setDate(today.getDate() + daysToAdd);
    }
  } else if (modifier === 'next') {
    // "next Monday" - always next week
    let daysToAdd;
    if (targetDayIndex > currentDayIndex) {
      // Target day is later this week, so add 7 to get next week
      daysToAdd = (targetDayIndex - currentDayIndex) + 7;
    } else {
      // Target day is same or earlier this week, calculate next week
      daysToAdd = 7 - currentDayIndex + targetDayIndex;
    }
    
    targetDate.setDate(today.getDate() + daysToAdd);
  }
  
  // Create full day range
  const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  
  console.log('Calculated target date:', start.toDateString());
  return { start, end };
}

function parseSpecificDate(dateStr) {
  console.log('Parsing date string:', dateStr);
  
  try {
    // Handle MM/DD format (e.g., "8/1")
    if (dateStr.match(/^\d{1,2}\/\d{1,2}$/)) {
      const [month, day] = dateStr.split('/').map(num => parseInt(num));
      const currentYear = new Date().getFullYear();
      
      // Create date for this year
      const targetDate = new Date(currentYear, month - 1, day);
      
      // If the date has already passed this year, assume next year
      const today = new Date();
      if (targetDate < today) {
        targetDate.setFullYear(currentYear + 1);
      }
      
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      
      console.log('Parsed date range:', start, 'to', end);
      return { start, end };
    }
    
    // Handle MM/DD/YYYY format
    if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
      const parts = dateStr.split('/');
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      
      // Handle 2-digit years
      if (year < 100) {
        year += 2000;
      }
      
      const targetDate = new Date(year, month - 1, day);
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      
      return { start, end };
    }
    
  } catch (error) {
    console.error('Error parsing date:', error);
  }
  
  return null;
}

function getSpecificTimeRange(baseRange, timeStr, timezone) {
  // Parse the time string (e.g., "3pm", "2:30pm")
  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!timeMatch) return baseRange;
  
  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2] || '0');
  const ampm = timeMatch[3].toLowerCase();
  
  // Convert to 24-hour format
  if (ampm === 'pm' && hours !== 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  
  // Create the specific time on the target date
  const targetDate = new Date(baseRange.start);
  targetDate.setHours(hours, minutes, 0, 0);
  
  // TODO: Handle timezone conversion if needed
  // For now, assume same timezone as user
  
  // Return a 1-hour window for availability checking
  const start = new Date(targetDate);
  const end = new Date(targetDate);
  end.setHours(end.getHours() + 1);
  
  return { start, end };
}

async function findSpecificEvent(queryInfo) {
  try {
    const { calendars } = await chrome.storage.local.get(['calendars']);
    
    if (!calendars || !calendars.length) {
      addMessage('I need to discover your calendars first. Try asking "list calendars"', 'assistant');
      return;
    }
    
    // Find calendar for the person
    const targetCalendar = findPersonCalendar(queryInfo.person, calendars);
    
    if (!targetCalendar) {
      const availableNames = getAvailablePersonNames(calendars);
      addMessage(`I couldn't find a calendar for "${queryInfo.person}". Available people: ${availableNames.join(', ')}`, 'assistant');
      return;
    }
    
    console.log('Searching for', queryInfo.eventType, 'for:', targetCalendar.summary);
    
    const response = await makeAuthorizedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events?` +
      `maxResults=500&singleEvents=true&orderBy=startTime&` +
      `timeMin=${queryInfo.dateRange.start.toISOString()}&timeMax=${queryInfo.dateRange.end.toISOString()}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Calendar API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Events found:', data.items?.length || 0);
    
    removeThinkingMessage();
    
    if (data.items && data.items.length > 0) {
      // Filter events to find the specific type
      const matchingEvents = data.items.filter(event => {
        const title = (event.summary || '').toLowerCase();
        
        // Search for the event type in the title
        if (queryInfo.eventType) {
          return title.includes(queryInfo.eventType);
        }
        
        // Also check for common flight keywords
        const flightKeywords = ['flight', 'airline', 'departure', 'arrival', 'boarding', 'gate'];
        if (title.includes('flight') || flightKeywords.some(keyword => title.includes(keyword))) {
          return true;
        }
        
        return false;
      });
      
      if (matchingEvents.length > 0) {
        // Format the matching events using our standard formatting
        const filteredEvents = filterAndSortEvents(matchingEvents);
        const eventsList = filteredEvents.map(event => formatEvent(event)).join('\n\n');
        
        const calendarOwner = targetCalendar.summary || queryInfo.person;
        const eventTypeDesc = queryInfo.eventType || 'event';
        const dateDesc = formatDateRange(queryInfo.dateRange);
        
        addMessage(`**${calendarOwner}'s ${eventTypeDesc} ${dateDesc}:**\n\n${eventsList}`, 'assistant');
      } else {
        const calendarOwner = targetCalendar.summary || queryInfo.person;
        const eventTypeDesc = queryInfo.eventType || 'event';
        const dateDesc = formatDateRange(queryInfo.dateRange);
        
        addMessage(`No ${eventTypeDesc} found for **${calendarOwner}** ${dateDesc}.`, 'assistant');
      }
    } else {
      const calendarOwner = targetCalendar.summary || queryInfo.person;
      const eventTypeDesc = queryInfo.eventType || 'event';
      const dateDesc = formatDateRange(queryInfo.dateRange);
      
      addMessage(`No events found for **${calendarOwner}** ${dateDesc}.`, 'assistant');
    }
    
  } catch (error) {
    console.error('Error finding specific event:', error);
    removeThinkingMessage();
    addMessage(`Sorry, I couldn't find ${queryInfo.person}'s ${queryInfo.eventType}. Error: ${error.message}`, 'assistant');
  }
}

async function findMeetingWith(queryInfo) {
  try {
    const { calendars } = await chrome.storage.local.get(['calendars']);
    
    if (!calendars || !calendars.length) {
      addMessage('I need to discover your calendars first. Try asking "list calendars"', 'assistant');
      return;
    }
    
    // Find calendar for the person
    const targetCalendar = findPersonCalendar(queryInfo.person, calendars);
    
    if (!targetCalendar) {
      const availableNames = getAvailablePersonNames(calendars);
      addMessage(`I couldn't find a calendar for "${queryInfo.person}". Available people: ${availableNames.join(', ')}`, 'assistant');
      return;
    }
    
    console.log('Searching for meetings with', queryInfo.companyName, 'for:', targetCalendar.summary);
    console.log('Date range:', queryInfo.dateRange.start.toISOString(), 'to', queryInfo.dateRange.end.toISOString());
    console.log('Today is:', new Date().toISOString());
    
    // Determine if this looks like an individual name vs company name
    const isLikelyIndividual = isIndividualName(queryInfo.companyName);
    console.log('Detected as individual:', isLikelyIndividual);
    
    const response = await makeAuthorizedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events?` +
      `maxResults=500&singleEvents=true&orderBy=startTime&` +
      `timeMin=${queryInfo.dateRange.start.toISOString()}&timeMax=${queryInfo.dateRange.end.toISOString()}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Calendar API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Events found:', data.items?.length || 0);
    
    // Debug: Log all event titles for inspection
    if (data.items && data.items.length > 0) {
      console.log('Event titles found:');
      data.items.forEach((event, index) => {
        const eventDate = event.start?.dateTime || event.start?.date;
        console.log(`${index + 1}. "${event.summary || 'No title'}" - ${eventDate}`);
        if (event.attendees) {
          console.log(`   Attendees: ${event.attendees.map(a => a.email || a.displayName).join(', ')}`);
        }
        
        // Special logging for potential Morgan Stanley meetings
        const title = (event.summary || '').toLowerCase();
        const attendeeEmails = event.attendees ? event.attendees.map(a => a.email || '').join(' ') : '';
        if (title.includes('morgan') || title.includes('stanley') || title.includes('ms') || 
            attendeeEmails.includes('morgan') || attendeeEmails.includes('stanley') || 
            attendeeEmails.includes('morganstanley') || attendeeEmails.includes('ms.com')) {
          console.log('🎯 POTENTIAL MORGAN STANLEY MATCH:', event.summary, 'Attendees:', attendeeEmails);
        }
      });
    }
    
    removeThinkingMessage();
    
    if (data.items && data.items.length > 0) {
      // Filter events to find meetings with the specified person/company
      const now = new Date();
      console.log('🔍 Starting to filter', data.items.length, 'events for:', queryInfo.companyName);
      const matchingEvents = data.items.filter(event => {
        // First, check if the event is actually in the future
        let eventTime;
        if (event.start.dateTime) {
          eventTime = new Date(event.start.dateTime);
        } else if (event.start.date) {
          eventTime = new Date(event.start.date);
        }
        
        if (eventTime && eventTime <= now) {
          console.log('Skipping past event:', event.summary, eventTime);
          return false;
        }
        
        const title = (event.summary || '').toLowerCase();
        const searchNameLower = queryInfo.companyName.toLowerCase();
        
        // Check if we're looking for a specific meeting type (like 1:1)
        const originalMessage = queryInfo.originalMessage.toLowerCase();
        const meetingTypeInQuery = ['1:1', 'one-on-one', 'sync', 'standup', 'check-in'].find(type => 
          originalMessage.includes(type)
        );
        
        if (meetingTypeInQuery) {
          // If user specified a meeting type, only return meetings that contain that type in title
          const meetingTypeMatches = title.includes(meetingTypeInQuery.toLowerCase()) || 
                                   (meetingTypeInQuery === '1:1' && title.includes('1:1')) ||
                                   (meetingTypeInQuery === 'one-on-one' && (title.includes('1:1') || title.includes('one on one')));
          
          if (!meetingTypeMatches) {
            console.log('Skipping - no meeting type match:', title, 'looking for:', meetingTypeInQuery);
            return false;
          }
        }
        
        // Check if name is in the meeting title (try multiple variations)
        const nameVariations = [
          searchNameLower,
          searchNameLower.replace(/\s+/g, ''), // Remove spaces: "morgan stanley" → "morganstanley"
          searchNameLower.replace(/\s+/g, '-'), // Replace spaces with dash: "morgan stanley" → "morgan-stanley"
          searchNameLower.split(' ')[0] // First word only: "morgan stanley" → "morgan"
        ];
        
        const titleMatch = nameVariations.some(variation => {
          if (title.includes(variation)) {
            console.log('Found name match in title:', title, 'matched variation:', variation);
            return true;
          }
          return false;
        });
        
        if (titleMatch) {
          return true;
        }
        
        // Check attendees
        if (event.attendees && event.attendees.length > 0) {
          if (isLikelyIndividual) {
            // For individuals: search attendee names and email addresses directly
            const hasIndividualAttendee = event.attendees.some(attendee => {
              if (attendee.email) {
                const emailLower = attendee.email.toLowerCase();
                const displayName = (attendee.displayName || '').toLowerCase();
                
                // Check if name appears in email or display name
                return emailLower.includes(searchNameLower) || 
                       displayName.includes(searchNameLower) ||
                       searchNameLower.split(' ').some(namePart => 
                         emailLower.includes(namePart) || displayName.includes(namePart)
                       );
              }
              return false;
            });
            
            if (hasIndividualAttendee) {
              console.log('Found individual match in attendees:', event.attendees.map(a => a.email || a.displayName));
              return true;
            }
          } else {
            // For companies: search email domains and attendee names
            const companyDomain = extractCompanyDomain(queryInfo.companyName);
            const hasCompanyAttendee = event.attendees.some(attendee => {
              if (attendee.email) {
                const emailDomain = attendee.email.split('@')[1]?.toLowerCase();
                const emailFull = attendee.email.toLowerCase();
                const displayName = (attendee.displayName || '').toLowerCase();
                
                // Check domain matching
                const domainMatch = emailDomain && (
                  emailDomain.includes(companyDomain) || 
                  companyDomain.includes(emailDomain.replace('.com', '')) ||
                  emailDomain.includes('morganstanley') || // Specific case for Morgan Stanley
                  emailDomain.includes('ms.com')
                );
                
                // Check if company name appears in email or display name
                const nameMatch = nameVariations.some(variation => 
                  emailFull.includes(variation) || displayName.includes(variation)
                );
                
                if (domainMatch || nameMatch) {
                  console.log('Found company match in attendee:', attendee.email, attendee.displayName, 'domain:', emailDomain);
                  return true;
                }
              }
              return false;
            });
            
            if (hasCompanyAttendee) {
              return true;
            }
          }
        }
        
        return false;
      });
      
      if (matchingEvents.length > 0) {
        // For "next meeting" queries, only return the first (chronologically next) meeting
        const eventsToShow = queryInfo.isNextMeetingQuery ? [matchingEvents[0]] : matchingEvents;
        
        const eventsList = eventsToShow.map(event => {
          const formattedEvent = formatEvent(event);
          
          // Add attendee info for company meetings
          let attendeeInfo = '';
          if (event.attendees && event.attendees.length > 1) {
            const companyAttendees = event.attendees.filter(attendee => 
              attendee.email && !attendee.email.includes('sourcegraph.com')
            );
            if (companyAttendees.length > 0) {
              const attendeeEmails = companyAttendees.map(a => a.email).join(', ');
              attendeeInfo = `\n  📧 ${attendeeEmails}`;
            }
          }
          
          return formattedEvent + attendeeInfo;
        }).join('\n\n');
        
        const calendarOwner = targetCalendar.summary || queryInfo.person;
        const timeDesc = formatDateRange(queryInfo.dateRange);
        
        if (queryInfo.isNextMeetingQuery) {
          addMessage(`Next meeting with **${queryInfo.companyName}** for **${calendarOwner}**:\n\n${eventsList}`, 'assistant');
        } else {
          addMessage(`Found ${eventsToShow.length} meeting(s) with **${queryInfo.companyName}** for **${calendarOwner}** ${timeDesc}:\n\n${eventsList}`, 'assistant');
        }
      } else {
        const calendarOwner = targetCalendar.summary || queryInfo.person;
        const timeDesc = formatDateRange(queryInfo.dateRange);
        
        addMessage(`No meetings with **${queryInfo.companyName}** found for **${calendarOwner}** ${timeDesc}.`, 'assistant');
      }
    } else {
      const calendarOwner = targetCalendar.summary || queryInfo.person;
      const timeDesc = formatDateRange(queryInfo.dateRange);
      
      addMessage(`No events found for **${calendarOwner}** ${timeDesc}.`, 'assistant');
    }
    
  } catch (error) {
    console.error('Error finding meeting:', error);
    removeThinkingMessage();
    addMessage(`Sorry, I couldn't find meetings with ${queryInfo.companyName}. Error: ${error.message}`, 'assistant');
  }
}

function extractCompanyDomain(companyName) {
  // Convert company name to likely domain format
  const domain = companyName.toLowerCase()
    .replace(/\s+/g, '')  // Remove spaces
    .replace(/[^a-z0-9]/g, '')  // Remove special characters
    .replace(/inc|corp|llc|ltd/g, '');  // Remove common suffixes
  
  return domain;
}

function isIndividualName(name) {
  // Simple heuristics to determine if this looks like an individual vs company name
  const lowerName = name.toLowerCase();
  
  // Company indicators
  const companyKeywords = ['inc', 'corp', 'llc', 'ltd', 'company', 'group', 'partners', 'capital', 'ventures', 'solutions', 'systems', 'technologies', 'tech', 'labs', 'bank', 'financial', 'consulting'];
  const hasCompanyKeyword = companyKeywords.some(keyword => lowerName.includes(keyword));
  
  // Individual indicators
  const nameParts = name.trim().split(/\s+/);
  const isShortName = nameParts.length <= 2; // Most individual names are 1-2 words
  const hasCommonFirstNames = ['john', 'jane', 'mike', 'sarah', 'david', 'mary', 'chris', 'alex', 'sam', 'carly', 'quinn', 'steve', 'anna', 'ben', 'lisa'].some(commonName => 
    lowerName.includes(commonName)
  );
  
  // If it has company keywords, likely a company
  if (hasCompanyKeyword) {
    return false;
  }
  
  // If it's short and/or has common first names, likely individual
  if (isShortName || hasCommonFirstNames) {
    return true;
  }
  
  // Default to individual for ambiguous cases (better to search broadly)
  return true;
}

async function findAvailableTimeSlots(queryInfo) {
  try {
    const { calendars } = await chrome.storage.local.get(['calendars']);
    
    if (!calendars || !calendars.length) {
      addMessage('I need to discover your calendars first. Try asking "list calendars"', 'assistant');
      return;
    }
    
    // Find calendar for the person
    const targetCalendar = findPersonCalendar(queryInfo.person, calendars);
    
    if (!targetCalendar) {
      const availableNames = getAvailablePersonNames(calendars);
      addMessage(`I couldn't find a calendar for "${queryInfo.person}". Available people: ${availableNames.join(', ')}`, 'assistant');
      return;
    }
    
    console.log('Finding available time slots for:', queryInfo.meetingDuration, 'with:', targetCalendar.summary);
    
    // Get their existing events to find gaps
    const response = await makeAuthorizedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events?` +
      `maxResults=500&singleEvents=true&orderBy=startTime&` +
      `timeMin=${queryInfo.dateRange.start.toISOString()}&timeMax=${queryInfo.dateRange.end.toISOString()}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Calendar API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Events found for availability analysis:', data.items?.length || 0);
    
    removeThinkingMessage();
    
    // Parse meeting duration
    const durationMatch = queryInfo.meetingDuration.match(/(\d+)\s+(minute|hour)/i);
    let durationMinutes = 30; // default
    if (durationMatch) {
      const amount = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      durationMinutes = unit === 'hour' ? amount * 60 : amount;
    }
    
    // For now, provide a helpful message about scheduling
    const calendarOwner = targetCalendar.summary || queryInfo.person;
    const timeDesc = formatDateRange(queryInfo.dateRange);
    
    addMessage(`I found ${data.items?.length || 0} existing events for **${calendarOwner}** ${timeDesc}. For detailed availability analysis and scheduling, you might want to check their calendar directly or use a scheduling tool like Calendly.`, 'assistant');
    
  } catch (error) {
    console.error('Error finding available time slots:', error);
    removeThinkingMessage();
    addMessage(`Sorry, I couldn't analyze availability for ${queryInfo.person}. Error: ${error.message}`, 'assistant');
  }
}

async function checkPersonAvailability(queryInfo) {
  try {
    const { calendars } = await chrome.storage.local.get(['calendars']);
    
    if (!calendars || !calendars.length) {
      addMessage('I need to discover your calendars first. Try asking "list calendars"', 'assistant');
      return;
    }
    
    // Find calendar for the person
    const targetCalendar = findPersonCalendar(queryInfo.person, calendars);
    
    if (!targetCalendar) {
      const availableNames = getAvailablePersonNames(calendars);
      addMessage(`I couldn't find a calendar for "${queryInfo.person}". Available people: ${availableNames.join(', ')}`, 'assistant');
      return;
    }
    
    console.log('Checking availability for:', targetCalendar.summary, 'at', queryInfo.dateRange);
    
    const response = await makeAuthorizedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events?` +
      `maxResults=500&singleEvents=true&orderBy=startTime&` +
      `timeMin=${queryInfo.dateRange.start.toISOString()}&timeMax=${queryInfo.dateRange.end.toISOString()}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Calendar API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Conflicts found:', data.items?.length || 0);
    
    removeThinkingMessage();
    
    const calendarOwner = targetCalendar.summary || queryInfo.person;
    const timeDesc = formatTimeSlot(queryInfo);
    
    if (data.items && data.items.length > 0) {
      // Filter out OOO and other excluded events
      const relevantEvents = filterAndSortEvents(data.items);
      
      if (queryInfo.specificTime) {
        // For specific time queries, check for conflicts
        const conflictingEvents = relevantEvents.filter(event => {
          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);
          const requestStart = queryInfo.dateRange.start;
          const requestEnd = queryInfo.dateRange.end;
          
          // Check if events overlap with requested time slot
          return (eventStart < requestEnd && eventEnd > requestStart);
        });
        
        if (conflictingEvents.length > 0) {
          const conflictsList = conflictingEvents.map(event => {
            const start = event.start.dateTime || event.start.date;
            const end = event.end.dateTime || event.end.date;
            const startTime = new Date(start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const endTime = new Date(end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const title = event.summary || 'No title';
            
            return `${startTime}-${endTime}: ${title}`;
          }).join('\n');
          
          addMessage(`**${calendarOwner}** is **NOT available** ${timeDesc}\n\n**Conflicts:**\n${conflictsList}`, 'assistant');
        } else {
          // Show other events for context
          const otherEventsList = relevantEvents.map(event => {
            const start = event.start.dateTime || event.start.date;
            const end = event.end.dateTime || event.end.date;
            const startTime = new Date(start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const endTime = new Date(end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const title = event.summary || 'No title';
            
            return `${startTime}-${endTime}: ${title}`;
          }).join('\n');
          
          addMessage(`**${calendarOwner}** is **AVAILABLE** ${timeDesc}\n\n**Other events that day:**\n${otherEventsList}`, 'assistant');
        }
      } else {
        // For general availability questions, find available time blocks
        const availableBlocks = findAvailableTimeBlocks(relevantEvents, queryInfo.dateRange);
        
        if (availableBlocks.length > 0) {
          const blocksList = availableBlocks.map(block => 
            `${block.start} - ${block.end}`
          ).join('\n');
          
          addMessage(`**${calendarOwner}** is **AVAILABLE** ${timeDesc}:\n\n${blocksList}`, 'assistant');
        } else {
          addMessage(`**${calendarOwner}** appears **BUSY** ${timeDesc} (no significant gaps between events)`, 'assistant');
        }
      }
    } else {
      addMessage(`**${calendarOwner}** is **AVAILABLE** ${timeDesc}\n\n(No events scheduled)`, 'assistant');
    }
    
  } catch (error) {
    console.error('Error checking availability:', error);
    removeThinkingMessage();
    addMessage(`Sorry, I couldn't check ${queryInfo.person}'s availability. Error: ${error.message}`, 'assistant');
  }
}

function findAvailableTimeBlocks(events, dateRange) {
  // Filter to only timed events (not all-day)
  const timedEvents = events.filter(event => event.start.dateTime);
  
  if (timedEvents.length === 0) {
    return [{ start: '9:00 AM', end: '5:00 PM' }]; // Default work hours if no events
  }
  
  // Sort events by start time
  timedEvents.sort((a, b) => {
    return new Date(a.start.dateTime) - new Date(b.start.dateTime);
  });
  
  const availableBlocks = [];
  const workStart = new Date(dateRange.start);
  workStart.setHours(9, 0, 0, 0); // 9 AM
  const workEnd = new Date(dateRange.start);
  workEnd.setHours(17, 0, 0, 0); // 5 PM
  
  let currentTime = workStart;
  
  for (const event of timedEvents) {
    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    
    // Skip events outside work hours
    if (eventEnd <= workStart || eventStart >= workEnd) continue;
    
    // Adjust event times to work hours
    const adjustedEventStart = eventStart < workStart ? workStart : eventStart;
    const adjustedEventEnd = eventEnd > workEnd ? workEnd : eventEnd;
    
    // If there's a gap before this event
    if (currentTime < adjustedEventStart) {
      const gapMinutes = (adjustedEventStart - currentTime) / (1000 * 60);
      
      // Only include gaps of 30+ minutes
      if (gapMinutes >= 30) {
        availableBlocks.push({
          start: formatTimeWithZone(currentTime),
          end: formatTimeWithZone(adjustedEventStart)
        });
      }
    }
    
    // Move current time to end of this event
    currentTime = adjustedEventEnd > currentTime ? adjustedEventEnd : currentTime;
  }
  
  // Check for time after last event
  if (currentTime < workEnd) {
    const gapMinutes = (workEnd - currentTime) / (1000 * 60);
    
    if (gapMinutes >= 30) {
      availableBlocks.push({
        start: formatTimeWithZone(currentTime),
        end: formatTimeWithZone(workEnd)
      });
    }
  }
  
  return availableBlocks;
}

function formatTimeSlot(queryInfo) {
  if (queryInfo.specificTime) {
    const dateDesc = formatDateRange(queryInfo.dateRange);
    const timeDesc = queryInfo.specificTime;
    const tzDesc = queryInfo.timezone ? ` ${queryInfo.timezone}` : '';
    return `${dateDesc} at ${timeDesc}${tzDesc}`;
  } else {
    return formatDateRange(queryInfo.dateRange);
  }
}

async function getPersonCalendarEvents(queryInfo) {
  try {
    const { calendars } = await chrome.storage.local.get(['calendars']);
    
    if (!calendars || !calendars.length) {
      addMessage('I need to discover your calendars first. Try asking "list calendars"', 'assistant');
      return;
    }
    
    // Find calendar for the person
    const targetCalendar = findPersonCalendar(queryInfo.person, calendars);
    
    if (!targetCalendar) {
      const availableNames = getAvailablePersonNames(calendars);
      addMessage(`I couldn't find a calendar for "${queryInfo.person}". Available people: ${availableNames.join(', ')}`, 'assistant');
      return;
    }
    
    console.log('Querying calendar:', targetCalendar.summary, 'for', queryInfo.person);
    
    const response = await makeAuthorizedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendar.id)}/events?` +
      `maxResults=500&singleEvents=true&orderBy=startTime&` +
      `timeMin=${queryInfo.dateRange.start.toISOString()}&timeMax=${queryInfo.dateRange.end.toISOString()}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Calendar API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Events found:', data.items?.length || 0);
    
    removeThinkingMessage();
    
    if (data.items && data.items.length > 0) {
      // Filter out unwanted events and organize
      const filteredEvents = filterAndSortEvents(data.items);
      
      if (filteredEvents.length > 0) {
        const eventsList = filteredEvents.map(event => formatEvent(event)).join('\n\n');
        
        const calendarOwner = targetCalendar.summary || queryInfo.person;
        const dateDesc = formatDateRange(queryInfo.dateRange);
        addMessage(`**${calendarOwner}'s events ${dateDesc}:**\n\n${eventsList}`, 'assistant');
      } else {
        const calendarOwner = targetCalendar.summary || queryInfo.person;
        const dateDesc = formatDateRange(queryInfo.dateRange);
        addMessage(`**${calendarOwner}** has no relevant events ${dateDesc} (filtered out unwanted events).`, 'assistant');
      }
    } else {
      const calendarOwner = targetCalendar.summary || queryInfo.person;
      const dateDesc = formatDateRange(queryInfo.dateRange);
      addMessage(`**${calendarOwner}** has no events ${dateDesc}.`, 'assistant');
    }
    
  } catch (error) {
    console.error('Error getting person calendar events:', error);
    removeThinkingMessage();
    addMessage(`Sorry, I couldn't fetch ${queryInfo.person}'s calendar. Error: ${error.message}`, 'assistant');
  }
}

function findPersonCalendar(personName, calendars) {
  const searchName = personName.toLowerCase();
  
  // Try exact matches first (name in calendar title)
  for (const calendar of calendars) {
    const calendarName = (calendar.summary || '').toLowerCase();
    if (calendarName.includes(searchName)) {
      return calendar;
    }
  }
  
  // Try email matches (name@domain)
  for (const calendar of calendars) {
    const email = calendar.id.toLowerCase();
    if (email.includes(searchName)) {
      return calendar;
    }
  }
  
  return null;
}

function getAvailablePersonNames(calendars) {
  return calendars.map(cal => {
    // Extract name from email or use calendar title
    if (cal.id.includes('@')) {
      return cal.id.split('@')[0];
    }
    return cal.summary || 'Unknown';
  }).slice(0, 10); // Limit to first 10
}

function formatDateShort(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `[${month}.${day}.${year}]`;
}

function formatDateShortNoBrackets(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}.${day}.${year}`;
}

function formatTimeWithZone(date) {
  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
  
  // Get timezone abbreviation
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMap = {
    'America/New_York': 'EST',
    'America/Chicago': 'CST', 
    'America/Denver': 'MST',
    'America/Los_Angeles': 'PST',
    'America/Phoenix': 'MST',
    'Pacific/Honolulu': 'HST'
  };
  
  const tzAbbr = tzMap[timeZone] || 'UTC';
  return `${timeStr} ${tzAbbr}`;
}

function filterAndSortEvents(events) {
  // Filter out unwanted events
  const filteredEvents = events.filter(event => {
    const title = (event.summary || '').toLowerCase();
    const excludeKeywords = [
      'lunch', 
      'at home', 
      'home',
      'cloud operations office hours',
      'ooo'  // Out of office
    ];
    return !excludeKeywords.some(keyword => title.includes(keyword));
  });
  
  // Sort: all-day events first, then by time
  return filteredEvents.sort((a, b) => {
    const aIsAllDay = !a.start.dateTime;
    const bIsAllDay = !b.start.dateTime;
    
    // All-day events come first
    if (aIsAllDay && !bIsAllDay) return -1;
    if (!aIsAllDay && bIsAllDay) return 1;
    
    // Within same category, sort by time
    const aTime = new Date(a.start.dateTime || a.start.date);
    const bTime = new Date(b.start.dateTime || b.start.date);
    return aTime - bTime;
  });
}

function formatEvent(event) {
  const start = event.start.dateTime || event.start.date;
  const startDate = new Date(start);
  const title = event.summary || 'No title';
  const isAllDay = !event.start.dateTime;
  
  if (isAllDay) {
    // All-day events: light green highlight
    const dateStr = formatDateShortNoBrackets(startDate);
    return `<span style="background-color: #d4edda; padding: 2px 4px; border-radius: 3px;"><strong>${dateStr} ALL DAY</strong> | ${title}</span>`;
  } else {
    // Timed events: bold date/time with | separator
    const dateStr = formatDateShortNoBrackets(startDate);
    const timeStr = formatTimeWithZone(startDate);
    return `<strong>${dateStr} at ${timeStr}</strong> | ${title}`;
  }
}

/**
 * Extract person name from message for AI analysis context
 */
function extractPersonFromMessage(message) {
  const lowerMessage = message.toLowerCase();
  
  // Common person references
  if (lowerMessage.includes('quinn') || lowerMessage.includes('sqs')) {
    return 'sqs';
  }
  if (lowerMessage.includes('adrienne') || lowerMessage.includes('me') || lowerMessage.includes('my')) {
    return 'adrienne';
  }
  
  return null;
}

/**
 * Determine date range from analysis options
 */
function determineDateRangeFromOptions(options) {
  if (!options || !options.timeRange) {
    return getTodayRange(); // Default
  }
  
  switch (options.timeRange) {
    case 'today':
      return getTodayRange();
    case 'tomorrow':
      return getTomorrowRange();
    case 'next_week':
      return getNextWeekRange();
    case 'this_week':
      return getThisWeekRange();
    default:
      return getTodayRange();
  }
}

function formatDateRange(dateRange) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const startDate = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate());
  const endDate = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  
  // Calculate the number of days in the range
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Single day ranges
  if (daysDiff <= 1) {
    if (startDate.getTime() === todayDate.getTime()) {
      return 'today';
    } else if (startDate.getTime() === tomorrowDate.getTime()) {
      return 'tomorrow';
    } else {
      return `on ${startDate.toLocaleDateString()}`;
    }
  }
  
  // Multi-day ranges
  if (startDate.getTime() === todayDate.getTime()) {
    if (daysDiff >= 30) {
      return 'over the next 30 days';
    } else if (daysDiff >= 7) {
      return `over the next ${daysDiff} days`;
    } else {
      return `over the next ${daysDiff} days`;
    }
  } else {
    return `from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
  }
}

async function getCalendarEvents(query) {
  try {
    console.log('Fetching calendar events...');
    
    // Get broader range of events (past 7 days + next 30 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const response = await makeAuthorizedRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `maxResults=500&singleEvents=true&orderBy=startTime&` +
      `timeMin=${weekAgo.toISOString()}&timeMax=${monthFromNow.toISOString()}`
    );
    
    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Google Calendar API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Calendar data:', data);
    console.log('Number of events found:', data.items?.length || 0);
    
    // Remove the "Thinking..." message
    removeThinkingMessage();
    
    if (data.items && data.items.length > 0) {
      // Filter out unwanted events and organize
      const filteredEvents = filterAndSortEvents(data.items);
      
      if (filteredEvents.length > 0) {
        const eventsList = filteredEvents.map(event => formatEvent(event)).join('\n\n');
        addMessage(`I found ${filteredEvents.length} events in your calendar:\n\n${eventsList}`, 'assistant');
      } else {
        addMessage('No relevant events found in your calendar (filtered out unwanted events).', 'assistant');
      }
    } else {
      addMessage('No events found in your calendar.', 'assistant');
    }
    
  } catch (error) {
    console.error('Error getting events:', error);
    removeThinkingMessage();
    addMessage(`Sorry, I couldn't fetch your calendar events. Error: ${error.message}`, 'assistant');
  }
}
