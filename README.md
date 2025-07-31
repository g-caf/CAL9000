# CAL 9000 - AI-Powered Calendar Assistant

A Chrome extension that acts as your personal calendar assistant, capable of understanding natural language queries about schedules and providing intelligent availability analysis.

## Features

- 🤖 **Natural Language Processing**: Ask questions like "When is Alex available on Monday?" or "Find 30 minutes with Sarah next week"
- 📅 **Google Calendar Integration**: Direct OAuth integration with full calendar access
- 🧠 **AI-Powered Analysis**: Uses OpenAI to analyze calendar data and find optimal meeting times
- 🎯 **Smart Person Mapping**: Automatically maps names and aliases for team members
- ⏰ **Business Hours Enforcement**: Only suggests reasonable meeting times (9 AM - 5 PM)
- 🌍 **Timezone Intelligence**: Handles multiple timezones with proper conversions
- 📊 **Conflict Resolution**: Finds available time slots while respecting existing meetings
- 💬 **Chat Interface**: Clean, conversational UI for natural interactions

## Installation

### Development Installation

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd CAL9000
   ```

2. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Set Up Environment**
   ```bash
   # In backend/ directory
   cp .env.example .env
   # Add your OpenAI API key to .env
   export OPENAI_API_KEY=your_key_here
   ```

4. **Start Backend Server**
   ```bash
   cd backend
   npm start
   ```

5. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Turn ON "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `Cal9000-v2` folder
   - The extension should now appear in your extensions list

6. **Authorize Google Calendar**
   - Click the CAL 9000 extension icon
   - Follow OAuth flow to grant calendar access
   - Start asking calendar questions!

## Usage Examples

### Availability Queries
- "When is Alex available on Monday 8/4?"
- "Find 30 minutes with Sarah next week"
- "What's my availability tomorrow?"
- "When can I meet with someone for 1 hour on Friday?"

### Event Queries  
- "Show my meetings today"
- "What's Alex doing tomorrow?"
- "What meetings do I have with [Company] this week?"
- "When is my next meeting?"

### Smart Features
- **Person Recognition**: Maps team member names and aliases automatically
- **Date Intelligence**: Understands "Monday", "next week", "8/4", "tomorrow"
- **Duration Parsing**: Extracts meeting lengths from natural language
- **Conflict Analysis**: Shows actual availability based on real calendar events

## Architecture

### Frontend (Chrome Extension)
- **Location**: `Cal9000-v2/`
- **Main Files**: `popup.html`, `popup.js`, `manifest.json`
- **Features**: Chat UI, OAuth flow, calendar API integration

### Backend (Node.js API)
- **Location**: `backend/`
- **Main Components**:
  - `routes/nlp.js` - API endpoints for query processing
  - `services/llm.js` - OpenAI integration and query parsing
  - `services/calendarIntelligence.js` - AI calendar analysis
  - `services/calendarSanitizer.js` - Data protection and anonymization

### Key Technologies
- **Frontend**: Chrome Extension API, Google Calendar API
- **Backend**: Node.js, Express, OpenAI GPT-4
- **AI**: Natural language processing, intelligent calendar analysis
- **Security**: Data sanitization, privacy-first design

## Environment Setup

### Required Environment Variables
```bash
# Backend (.env file)
OPENAI_API_KEY=your_openai_api_key
PORT=3000
NODE_ENV=development
```

### Deployment
- **Backend**: Deployed on Render.com
- **URL**: `https://cal9000.onrender.com`
- **Extension**: Loads unpacked for development

## Commands

### Development
- **Backend**: `cd backend && npm start` - Start development server
- **Extension**: Load extension in `chrome://extensions` with developer mode enabled

### Testing  
- **Backend Tests**: `cd backend && npm test` - Run data protection framework tests
- **Intelligence Tests**: `cd backend && node test-intelligence.js` - Test AI system
- **Coverage**: `cd backend && npm run test:coverage` - Run tests with coverage

### Production
- **Build**: No build process needed for basic extension
- **Deploy**: Backend auto-deploys to Render.com on git push

## Project Structure

```
CAL9000/
├── Cal9000-v2/           # Chrome Extension
│   ├── popup.html        # Main UI
│   ├── popup.js          # Frontend logic with AI integration
│   ├── background.js     # Service worker
│   └── manifest.json     # Extension manifest (v3)
├── backend/              # Node.js Backend
│   ├── services/
│   │   ├── calendarIntelligence.js  # AI analysis engine
│   │   ├── schedulingEngine.js      # Smart scheduling
│   │   ├── calendarSanitizer.js     # Data protection
│   │   └── llm.js                   # OpenAI integration
│   ├── routes/nlp.js     # API endpoints
│   └── package.json      # Dependencies
└── README.md            # This file
```

## API Endpoints

### Core Endpoints
- `POST /api/nlp/route` - Intelligent query routing and analysis
- `POST /api/nlp/analyze` - Direct calendar analysis  
- `POST /api/nlp/schedule` - Smart scheduling operations
- `POST /api/nlp/parse` - Traditional query parsing (backwards compatible)

### Analysis Types
- `conflict_resolution` - Find optimal meeting times
- `pattern_recognition` - Analyze scheduling patterns
- `availability_optimization` - Optimize calendar efficiency
- `multi_person_scheduling` - Multi-calendar coordination
- `meeting_intelligence` - Meeting type recommendations
- `focus_time_analysis` - Deep work optimization

## Data Protection

### Privacy Features
- **Data Anonymization**: Sensitive information removed before AI processing
- **Safety Validation**: Multiple layers of data protection
- **Minimal Data**: Only essential calendar info sent to AI
- **Secure Sessions**: Proper authentication and session management

### Security Measures
- **XSS Prevention**: Input sanitization and validation
- **CORS Protection**: Extension ID verification
- **Rate Limiting**: API abuse prevention
- **CSP Headers**: Content Security Policy enforcement

## Contributing

1. **Issues**: Report bugs or request features via GitHub issues
2. **Development**: Follow the installation steps above
3. **Testing**: Run test suites before submitting PRs
4. **Documentation**: Update README and comments for new features

## Version History

- **v2.0** - Complete rebuild with AI integration
- **v1.1** - Added intelligent calendar analysis system
- **v1.0** - Initial Chrome extension with basic functionality

## Support

For questions or issues:
1. Check the troubleshooting section below
2. Review the project documentation
3. Contact the development team

## Troubleshooting

**Extension not working?**
- Refresh the page and try again
- Check that backend server is running
- Verify OpenAI API key is configured

**Calendar access issues?**
- Re-authorize through the extension popup
- Check Google Calendar permissions
- Ensure you're signed into the correct Google account

**AI responses seem wrong?**
- Verify your query is clear and specific
- Check that the backend logs show proper parsing
- Ensure calendar events are loading correctly

**Backend connection errors?**
- Verify the backend server is running on correct port
- Check network connectivity
- Review CORS and security settings
