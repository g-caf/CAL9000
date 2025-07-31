# CAL 9000 - Intelligent Calendar Assistant

## Commands
- **Dev**: Load extension in `chrome://extensions` with developer mode enabled
- **Backend**: `cd backend && npm start` to run backend server
- **Test**: `cd backend && npm test` to run data protection framework tests
- **Test (Intelligence)**: `cd backend && node test-intelligence.js` to test AI system
- **Test (Coverage)**: `cd backend && npm run test:coverage` to run tests with coverage
- **Build**: No build process needed for basic extension
- **Lint**: No linting configured yet

## Project Structure
- `manifest.json` - Extension manifest (v3)
- `Cal9000-v2/popup.html/js` - Main UI with intelligent analysis support
- `background.js` - Service worker for periodic sync
- `backend/` - Node.js backend with intelligent calendar analysis
  - `services/calendarIntelligence.js` - Main AI analysis engine
  - `services/schedulingEngine.js` - Smart scheduling operations
  - `services/calendarSanitizer.js` - Data protection and anonymization
  - `services/llm.js` - Updated LLM service with intelligent routing
  - `routes/nlp.js` - API endpoints for intelligent analysis
- `package.json` - Project metadata

## Intelligent Calendar System
The project now includes a comprehensive AI-powered calendar analysis system:

### Key Features
- **Smart Scheduling**: AI finds optimal meeting times
- **Pattern Recognition**: Analyzes calendar habits and efficiency
- **Focus Time Optimization**: Identifies deep work opportunities
- **Conflict Resolution**: Intelligently resolves scheduling conflicts
- **Data Protection**: Privacy-first anonymization before AI processing

### API Endpoints
- `POST /api/nlp/route` - Intelligent query routing
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

### Environment Setup
```bash
# Backend setup
cd backend
npm install
# Set OpenAI API key for AI features
export OPENAI_API_KEY=your_key_here
npm start
```

### Testing
```bash
# Test intelligent calendar system
cd backend
node test-intelligence.js
```

See `INTELLIGENT_CALENDAR_SYSTEM.md` for complete documentation.
