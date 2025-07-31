# CAL 9000 - AI Calendar Assistant Specification

## Overview

CAL 9000 is an intelligent Chrome extension that serves as a personal calendar assistant. It combines natural language processing, Google Calendar integration, and AI-powered analysis to help users manage their schedules through conversational interactions.

## Core Features

### 1. Natural Language Query Processing
- **Query Types**: Availability checks, event queries, scheduling requests
- **Date Intelligence**: Handles relative dates (Monday, next week, tomorrow) and specific dates (8/4, August 4th)
- **Person Recognition**: Maps names and aliases for team members automatically
- **Duration Extraction**: Parses meeting lengths from natural language ("30 minutes", "1 hour")

### 2. Google Calendar Integration
- **OAuth Authentication**: Secure calendar access with user consent
- **Real-Time Data**: Fetches current calendar events for analysis
- **Multi-Calendar Support**: Can access different people's calendars when authorized
- **Event Filtering**: Intelligent filtering of relevant vs. transparent events

### 3. AI-Powered Calendar Analysis
- **OpenAI Integration**: Uses GPT-4o-mini for intelligent calendar processing
- **Conflict Resolution**: Finds optimal meeting times avoiding scheduling conflicts
- **Business Hours Enforcement**: Restricts suggestions to 9 AM - 5 PM
- **Timezone Intelligence**: Handles multiple timezones with proper conversions

### 4. Conversational Interface
- **Chat UI**: Clean, messaging-style interface for natural interactions
- **Context Awareness**: Understands follow-up questions and maintains conversation flow
- **Feedback Messages**: Provides clear explanations when no availability is found

## Technical Architecture

### Frontend (Chrome Extension)

#### Extension Structure
- **Manifest Version**: 3
- **Content Security Policy**: Strict CSP for security
- **Permissions**: `storage`, `identity`, calendar scopes, backend API access
- **UI Framework**: Vanilla JavaScript with modern ES6+ features

#### Key Components
- **`popup.html`**: Main interface with chat-style layout
- **`popup.js`**: Core logic for NLP, calendar integration, and AI analysis
- **`background.js`**: Service worker for periodic sync and background tasks
- **`manifest.json`**: Extension configuration and permissions

#### Data Flow
1. User inputs natural language query
2. Frontend parses query and extracts calendar events
3. Sends request to backend AI analysis
4. Displays formatted results in chat interface

### Backend (Node.js API)

#### Server Architecture
- **Framework**: Express.js with CORS and security middleware
- **Deployment**: Render.com cloud hosting
- **Authentication**: Extension ID verification for API access
- **Rate Limiting**: Prevents API abuse

#### Core Services

##### `llm.js` - Language Model Integration
- **OpenAI API**: GPT-4o-mini for query parsing and analysis
- **Prompt Engineering**: Specialized prompts for calendar operations
- **Response Parsing**: Structured JSON output from AI
- **Fallback Logic**: Graceful degradation when AI unavailable

##### `calendarIntelligence.js` - AI Analysis Engine
- **Conflict Resolution**: Finds optimal meeting times
- **Pattern Recognition**: Analyzes scheduling patterns
- **Availability Optimization**: Suggests calendar improvements
- **Focus Time Analysis**: Identifies deep work opportunities

##### `calendarSanitizer.js` - Data Protection
- **Anonymization**: Removes sensitive information before AI processing
- **Safety Validation**: Multiple layers of data protection
- **Minimal Data**: Only essential calendar info sent to AI

##### `schedulingEngine.js` - Smart Scheduling
- **Multi-Person Coordination**: Handles complex scheduling scenarios
- **Intelligent Suggestions**: Context-aware meeting recommendations
- **Buffer Time**: Ensures adequate breaks between meetings

#### API Endpoints
- **`POST /api/nlp/route`**: Main endpoint for intelligent query routing
- **`POST /api/nlp/analyze`**: Direct calendar analysis
- **`POST /api/nlp/schedule`**: Smart scheduling operations
- **`POST /api/nlp/parse`**: Traditional query parsing (legacy support)

## Query Processing Pipeline

### 1. Query Analysis
```javascript
{
  "intent": "find_availability|show_events|schedule_meeting|calendar_view",
  "person": "alex|sarah|[any person name]|null",
  "duration": "30 minutes|1 hour|null",
  "dateRange": "today|tomorrow|monday|2025-08-04|null",
  "meetingType": "1:1|sync|standup|call|meeting|null",
  "companyName": "company name|null",
  "needsAvailabilityCalculation": true/false
}
```

### 2. Calendar Data Retrieval
- **Target Calendar**: Identified based on person mapping
- **Date Filtering**: Events filtered to relevant time range
- **Event Validation**: Skips transparent, cancelled, or declined events

### 3. AI Analysis
- **Context Provision**: Current date, meeting requirements, sanitized events
- **Business Rules**: 9 AM - 5 PM enforcement, conflict avoidance
- **Output Format**: Structured recommendations with confidence levels

### 4. Response Formatting
- **Date Format**: MM.DD.YY | HH:MMAM PST - HH:MMPM PST
- **Clear Messaging**: Explanations for no availability scenarios
- **Conflict Display**: Clean formatting of busy periods

## Person and Date Mapping

### Person Recognition
```javascript
// Name mapping rules (applied in LLM prompt)
// Maps common aliases to canonical names for team members
"alias1" → "person1" (configured per organization)
"alias2" → "person2" 
"my" → "[current user]"
"me" → "[current user]" 
"i" → "[current user]"
// For any other person names, keep them as-is
// Mappings are configurable per organization
```

### Date Intelligence
```javascript
// Date parsing capabilities
"today" → Current date
"tomorrow" → Next day
"monday" → Next Monday occurrence
"next week" → Following week range
"8/4" → August 4th of current/next year
"Monday, August 4th" → Specific date with day validation
"2025-08-04" → ISO date format
```

## Security and Privacy

### Data Protection
- **Minimal Data Sharing**: Only essential calendar information processed
- **Anonymization Pipeline**: Removes emails, phone numbers, sensitive URLs
- **Safety Validation**: Multiple checks before AI processing
- **Temporary Processing**: No long-term storage of calendar data

### Security Measures
- **Extension ID Verification**: CORS protection for API access
- **XSS Prevention**: Input sanitization and validation
- **Secure Sessions**: Proper authentication flow
- **Rate Limiting**: API abuse prevention
- **CSP Headers**: Content Security Policy enforcement

## User Experience Design

### Interface Principles
- **Conversational**: Natural language input/output
- **Contextual**: Understanding of follow-up questions
- **Informative**: Clear explanations when no results found
- **Consistent**: Uniform date/time formatting throughout
- **Responsive**: Quick feedback and loading states

### Error Handling
- **No Events Found**: Explains why and suggests alternatives
- **Calendar Access Issues**: Clear re-authorization guidance
- **AI Service Errors**: Graceful fallback to basic functionality
- **Network Issues**: Appropriate timeout and retry logic

### Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Semantic HTML and ARIA labels
- **Color Contrast**: Accessible color schemes
- **Font Sizing**: Readable text at all zoom levels

## Performance Considerations

### Frontend Optimization
- **Lazy Loading**: Calendar data fetched only when needed
- **Caching**: Smart caching of calendar list and recent queries
- **Debouncing**: Prevents excessive API calls during typing
- **Error Boundaries**: Graceful handling of component failures

### Backend Optimization
- **Response Compression**: Gzip compression for API responses
- **Connection Pooling**: Efficient database/API connections
- **Caching Strategies**: Redis for session and query caching
- **Load Balancing**: Horizontal scaling on Render.com

### AI Optimization
- **Token Management**: Efficient prompt design to minimize costs
- **Response Streaming**: Progressive response delivery
- **Model Selection**: GPT-4o-mini for optimal cost/performance
- **Fallback Models**: Degradation strategy for service outages

## Testing Strategy

### Unit Tests
- **Frontend Logic**: Query parsing, date handling, UI interactions
- **Backend Services**: API endpoints, data processing, security
- **AI Integration**: Mock responses, error handling, edge cases

### Integration Tests
- **End-to-End**: Full user workflow from query to response
- **Calendar API**: Real calendar integration testing
- **Cross-Browser**: Chrome extension compatibility
- **Performance**: Load testing and response time validation

### Security Tests
- **Data Sanitization**: Verify sensitive data removal
- **API Security**: Authentication, authorization, rate limiting
- **XSS Prevention**: Input validation and output escaping
- **Privacy Compliance**: Data handling audit

## Deployment and Operations

### Development Environment
- **Local Backend**: `npm start` for development server
- **Extension Loading**: Chrome developer mode for testing
- **Hot Reload**: Automatic updates during development
- **Debug Tools**: Console logging and Chrome DevTools integration

### Production Environment
- **Backend Hosting**: Render.com with auto-deploy from git
- **Monitoring**: Application performance and error tracking
- **Logging**: Structured logging for debugging and analytics
- **Backup**: Regular data backup and disaster recovery

### Configuration Management
- **Environment Variables**: API keys, feature flags, service URLs
- **Feature Toggles**: Gradual rollout of new capabilities
- **Version Management**: Semantic versioning and release notes
- **Rollback Strategy**: Quick reversion for critical issues

## Future Enhancements

### Planned Features
- **Meeting Scheduling**: Direct calendar event creation
- **Smart Notifications**: Proactive scheduling suggestions
- **Team Coordination**: Multi-person availability analysis
- **Integration Expansion**: Slack, Teams, other calendar systems

### Technical Improvements
- **Offline Support**: Cached data for limited offline functionality
- **Advanced AI**: More sophisticated calendar pattern recognition
- **Real-Time Sync**: Live calendar updates and conflict detection
- **Mobile Support**: Extension adaptation for mobile browsers

### User Experience
- **Voice Interface**: Speech-to-text for hands-free operation
- **Customization**: User preferences for formatting and behavior
- **Analytics**: Usage insights and optimization recommendations
- **Collaboration**: Shared calendar intelligence across teams
