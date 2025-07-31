# Calendar Data Protection Framework

A comprehensive data anonymization and protection system for safely processing Google Calendar data before sending to OpenAI APIs.

## Overview

This framework ensures that sensitive calendar information is properly anonymized while preserving enough semantic meaning for intelligent AI analysis. It prevents exposure of personal data, meeting credentials, and confidential information.

## Features

### 🔒 **Complete Conference Data Protection**
- Removes all Zoom, Teams, Google Meet, and WebEx URLs
- Strips meeting IDs, passcodes, dial-in numbers
- Sanitizes conference data objects and hangout links
- Handles complex meeting descriptions with embedded credentials

### 👥 **Smart Attendee Anonymization**
- Preserves person-to-person relationships while anonymizing identities
- Maintains organizational context (CLIENT_FIRM, OUR_COMPANY, VENDOR)
- Keeps response status and meeting roles intact
- Maps anonymized data back to originals after AI processing

### 📝 **Intelligent Content Sanitization**
- Removes sensitive project codes, ticket numbers, internal references
- Detects and anonymizes confidential keywords and phrases
- Preserves meeting types and patterns for analysis
- Maintains semantic meaning while protecting specifics

### 🏢 **Location Protection**
- Anonymizes specific addresses while preserving location types
- Classifies locations (VIRTUAL_MEETING, CONFERENCE_ROOM, OFFICE_LOCATION)
- Maintains geographic context without exposing exact addresses

### ⚙️ **Flexible Protection Levels**
- **MINIMAL**: Basic conference data removal only
- **STANDARD**: Full anonymization with semantic preservation
- **MAXIMUM**: Aggressive protection with minimal data exposure

## Quick Start

```javascript
const DataProtectionService = require('./services/dataProtection');

// Create production-ready instance
const dataProtection = DataProtectionService.createProductionInstance();

// Process calendar data
const result = await dataProtection.processCalendarData(calendarEvents, 'STANDARD');

// Send safe data to OpenAI
const openaiResponse = await sendToOpenAI(result.safeData);

// Map results back to original data
const mappedResults = await dataProtection.processOpenAIResults(openaiResponse);
```

## Architecture

```
DataProtectionService (Main orchestrator)
├── CalendarSanitizer (Calendar-specific processing)
├── ConferenceProtection (Meeting credentials removal)
└── AnonymizationManager (Identity mapping and anonymization)
```

## Core Components

### DataProtectionService

Main orchestrator that coordinates all protection activities.

```javascript
const dataProtection = new DataProtectionService({
  strictMode: true,          // Fail on safety validation errors
  enableLogging: false,      // Enable debug logging
  allowMinimalLocation: true, // Allow generic location types
  preserveTimePatterns: true  // Keep meeting timing intact
});
```

### CalendarSanitizer

Handles Google Calendar event structure and sanitization.

```javascript
const sanitizer = new CalendarSanitizer();
const safeEvents = sanitizer.createMinimalSafeData(events);
```

### ConferenceProtection

Specialized removal of meeting credentials and conference data.

```javascript
const confProtection = new ConferenceProtection();
const cleaned = confProtection.sanitizeEvent(event);
```

### AnonymizationManager

Manages consistent anonymization and reverse mapping.

```javascript
const anonymizer = new AnonymizationManager();
const anonPerson = anonymizer.getAnonymizedPerson('john@company.com');
// Returns: "PERSON_1"
```

## Protection Levels

### MINIMAL Protection
- ✅ Removes conference URLs and credentials
- ❌ Keeps attendee emails and names
- ❌ Preserves original content
- **Use case**: Internal processing where some identity is acceptable

### STANDARD Protection (Recommended)
- ✅ Full conference data removal
- ✅ Attendee anonymization with relationship preservation
- ✅ Content sanitization with semantic meaning
- ✅ Location type classification
- **Use case**: OpenAI processing for calendar analysis

### MAXIMUM Protection
- ✅ Aggressive anonymization of all content
- ✅ Minimal data exposure
- ✅ Generic meeting type classifications only
- **Use case**: Highly sensitive environments or compliance requirements

## Example Transformations

### Before Protection (Original Event)
```javascript
{
  summary: "Q1 Budget Review - Project Phoenix (Confidential)",
  description: `
    CONFIDENTIAL - Internal discussion only
    Join Zoom: https://company.zoom.us/j/87654321098?pwd=secret123
    Meeting ID: 876 5432 1098
    Passcode: phoenix2024
  `,
  location: "Executive Conference Room, Floor 15, 123 Corporate Plaza",
  attendees: [
    {
      email: "cfo@company.com",
      displayName: "Chief Financial Officer"
    },
    {
      email: "external.consultant@bigcorp.com", 
      displayName: "External Consultant"
    }
  ]
}
```

### After STANDARD Protection
```javascript
{
  summary: "Q1 Budget Review - PROJECT_1",
  description: "[SENSITIVE_CONTENT_REMOVED] [MEETING_INFO_REMOVED]",
  location: "CONFERENCE_ROOM_1",
  attendees: [
    {
      email: "PERSON_1@OUR_COMPANY_1",
      displayName: "PERSON_1"
    },
    {
      email: "PERSON_2@CLIENT_FIRM_1",
      displayName: "PERSON_2"
    }
  ],
  metadata: {
    hasAttendees: true,
    attendeeCount: 2,
    duration: 90,
    isRecurring: false
  }
}
```

## Safety Validation

The framework includes comprehensive safety validation:

```javascript
const validation = dataProtection.validateDataSafety(processedData);

if (!validation.isSafe) {
  console.log('Safety issues found:', validation.issues);
  // Issues might include:
  // - "Potential email found at attendees[0].email"
  // - "Potential phone number found at description"
  // - "Potential URL found at location"
}
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

The test suite includes:
- ✅ Conference data removal for all platforms
- ✅ Anonymization consistency and reverse mapping
- ✅ Safety validation edge cases
- ✅ Real-world calendar event scenarios
- ✅ Batch processing and performance tests

## Configuration Options

```javascript
const options = {
  strictMode: false,         // Whether to fail on safety warnings
  enableLogging: true,       // Enable debug output
  allowMinimalLocation: true, // Allow generic location categories
  preserveTimePatterns: true, // Keep meeting timing for analysis
};

const dataProtection = new DataProtectionService(options);
```

## Integration with OpenAI

### Complete Integration Example

```javascript
async function processCalendarWithAI(calendarEvents) {
  // Step 1: Protect calendar data
  const protection = DataProtectionService.createProductionInstance();
  const result = await protection.processCalendarData(calendarEvents, 'STANDARD');
  
  // Step 2: Validate safety
  if (!result.safetyValidation.isSafe) {
    throw new Error('Calendar data failed safety validation');
  }
  
  // Step 3: Send to OpenAI
  const openaiResponse = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "user",
      content: `Analyze these calendar events: ${JSON.stringify(result.safeData)}`
    }]
  });
  
  // Step 4: Map results back to original context
  const mappedResults = await protection.processOpenAIResults(
    openaiResponse.choices[0].message.content
  );
  
  return mappedResults;
}
```

### Monitoring and Statistics

```javascript
// Get processing statistics
const stats = dataProtection.getProtectionStats();
console.log({
  eventsProcessed: stats.eventsProcessed,
  attendeesAnonymized: stats.attendeesAnonymized, 
  conferenceDataRemoved: stats.conferenceDataRemoved,
  sensitiveDataRemoved: stats.sensitiveDataRemoved
});
```

## Security Best Practices

1. **Always use STANDARD or MAXIMUM protection** for external API calls
2. **Validate data safety** before transmission with `validateDataSafety()`
3. **Use strict mode** in production environments
4. **Regularly test** with real calendar data to catch edge cases
5. **Monitor processing statistics** for unusual patterns
6. **Reset anonymization state** between different user sessions

## Error Handling

```javascript
try {
  const result = await dataProtection.processCalendarData(events, 'STANDARD');
} catch (error) {
  if (error.message.includes('safety validation failed')) {
    // Handle validation failure
    console.error('Data contains unsafe content:', error.message);
  } else {
    // Handle other processing errors
    console.error('Processing failed:', error.message);
  }
}
```

## Performance Considerations

- **Batch processing**: Processes multiple events efficiently
- **Memory management**: Automatically manages anonymization mappings
- **Validation overhead**: Safety validation adds ~10-20ms per event
- **Reset state**: Call `reset()` periodically to clear mappings

## Compliance and Privacy

This framework helps meet privacy requirements by:
- ✅ Preventing exposure of personal identifiable information (PII)
- ✅ Removing meeting access credentials and conference data
- ✅ Anonymizing email addresses and names
- ✅ Sanitizing sensitive business information
- ✅ Providing audit trails through processing statistics

## Contributing

When adding new protection features:

1. Add comprehensive tests in `tests/dataProtection.test.js`
2. Update safety validation in `validateDataSafety()`
3. Document new configuration options
4. Test with real-world calendar data
5. Ensure reverse mapping works correctly

## Troubleshooting

### Common Issues

**Q: Data fails safety validation**
A: Check the validation issues array to see what sensitive data was detected. You may need to add new patterns to the sanitization rules.

**Q: Anonymization is inconsistent**
A: Ensure you're not calling `reset()` between related processing sessions. The same person should always get the same anonymized ID.

**Q: Conference data still appears in output**
A: Check for new conference platform patterns. Add them to `ConferenceProtection.conferencePatterns`.

**Q: Performance is slow with large datasets**
A: Consider processing events in smaller batches and using async processing for very large datasets.

## License

MIT License - see LICENSE file for details.
