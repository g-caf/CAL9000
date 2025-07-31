/**
 * Calendar-specific data sanitization for Google Calendar events
 */

const ConferenceProtection = require('./conferenceProtection');
const AnonymizationManager = require('../utils/anonymization');

class CalendarSanitizer {
  constructor() {
    this.conferenceProtection = new ConferenceProtection();
    this.anonymizer = new AnonymizationManager();
    
    // Patterns for sensitive project codes and internal references
    this.sensitivePatterns = [
      /\b[A-Z]{2,4}-\d{3,6}\b/g, // Project codes like ABC-1234
      /\b\d{4}-\d{4}\b/g, // Internal codes
      /\bticket\s*#?\s*\d+/gi, // Ticket numbers
      /\bpr\s*#?\s*\d+/gi, // PR numbers
      /\bissue\s*#?\s*\d+/gi, // Issue numbers
      /\bbug\s*#?\s*\d+/gi, // Bug numbers
    ];

    // Sensitive keywords that might expose internal information
    this.sensitiveKeywords = [
      'confidential', 'internal', 'private', 'nda', 'proprietary',
      'secret', 'restricted', 'classified', 'budget', 'salary',
      'contract', 'negotiation', 'acquisition', 'merger'
    ];
  }

  /**
   * Sanitize a complete calendar event
   */
  sanitizeEvent(event, options = {}) {
    const sanitized = { ...event };

    // Step 1: Remove conference data
    const conferenceClean = this.conferenceProtection.sanitizeEvent(sanitized);

    // Step 2: Anonymize attendees
    if (conferenceClean.attendees) {
      conferenceClean.attendees = this.anonymizeAttendees(conferenceClean.attendees);
    }

    // Step 3: Sanitize creator and organizer
    if (conferenceClean.creator) {
      conferenceClean.creator = this.anonymizePerson(conferenceClean.creator);
    }
    if (conferenceClean.organizer) {
      conferenceClean.organizer = this.anonymizePerson(conferenceClean.organizer);
    }

    // Step 4: Sanitize summary/title
    conferenceClean.summary = this.sanitizeText(conferenceClean.summary || '', options);

    // Step 5: Sanitize description
    conferenceClean.description = this.sanitizeText(conferenceClean.description || '', options);

    // Step 6: Sanitize location (preserve type, anonymize specifics)
    if (conferenceClean.location) {
      conferenceClean.location = this.anonymizer.getAnonymizedLocation(conferenceClean.location);
    }

    // Step 7: Remove or anonymize extended properties
    if (conferenceClean.extendedProperties) {
      conferenceClean.extendedProperties = this.sanitizeExtendedProperties(conferenceClean.extendedProperties);
    }

    // Step 8: Keep essential metadata but remove identifying info
    conferenceClean.id = this.generateAnonymousId();
    if (conferenceClean.iCalUID) {
      conferenceClean.iCalUID = this.generateAnonymousUID();
    }

    // Step 9: Preserve timing and recurrence patterns
    // (start, end, recurrence patterns are kept as-is for analysis)

    return conferenceClean;
  }

  /**
   * Anonymize attendee list while preserving relationships
   */
  anonymizeAttendees(attendees) {
    return attendees.map(attendee => {
      const anonymized = {
        responseStatus: attendee.responseStatus,
        optional: attendee.optional
      };

      // Anonymize email while preserving domain classification
      if (attendee.email) {
        const domain = attendee.email.split('@')[1];
        anonymized.email = `${this.anonymizer.getAnonymizedPerson(attendee.email)}@${this.anonymizer.getAnonymizedOrganization(domain)}`;
      }

      // Anonymize display name
      if (attendee.displayName) {
        anonymized.displayName = this.anonymizer.getAnonymizedPerson(attendee.email, attendee.displayName);
      }

      return anonymized;
    });
  }

  /**
   * Anonymize person (creator/organizer)
   */
  anonymizePerson(person) {
    const anonymized = {};

    if (person.email) {
      const domain = person.email.split('@')[1];
      anonymized.email = `${this.anonymizer.getAnonymizedPerson(person.email)}@${this.anonymizer.getAnonymizedOrganization(domain)}`;
    }

    if (person.displayName) {
      anonymized.displayName = this.anonymizer.getAnonymizedPerson(person.email, person.displayName);
    }

    if (person.self !== undefined) {
      anonymized.self = person.self;
    }

    return anonymized;
  }

  /**
   * Sanitize text content (titles, descriptions)
   */
  sanitizeText(text, options = {}) {
    if (!text) return text;

    let sanitized = text;

    // Remove sensitive patterns (project codes, ticket numbers, etc.)
    this.sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[CODE_REMOVED]');
    });

    // Check for sensitive keywords and anonymize them directly
    this.sensitiveKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '[SENSITIVE_WORD_REMOVED]');
    });

    // Anonymize what appears to be project names and company names
    sanitized = this.anonymizeProjectReferences(sanitized);

    // Clean up multiple consecutive removals
    sanitized = sanitized.replace(/\[CODE_REMOVED\]\s*\[CODE_REMOVED\]/g, '[CODE_REMOVED]');
    sanitized = sanitized.replace(/\[SENSITIVE_WORD_REMOVED\]\s*\[SENSITIVE_WORD_REMOVED\]/g, '[SENSITIVE_WORD_REMOVED]');

    return sanitized.trim();
  }

  /**
   * Anonymize project references while preserving semantic meaning
   */
  anonymizeProjectReferences(text) {
    // Look for capitalized project-like names and company names
    const projectPattern = /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const companyPattern = /\b[A-Z]{2,}\s+Corp\b|\b[A-Z][a-z]+\s+Corp\b/g;
    
    let sanitized = text;
    
    // Anonymize company names first
    sanitized = sanitized.replace(companyPattern, (match) => {
      return this.anonymizer.getAnonymizedProject(match);
    });
    
    // Then anonymize project names
    sanitized = sanitized.replace(projectPattern, (match) => {
      // Don't anonymize common words/phrases
      const commonPhrases = [
        'Google Calendar', 'Microsoft Teams', 'Zoom Meeting',
        'Board Meeting', 'Team Meeting', 'Daily Standup',
        'Project Review', 'Budget Review', 'Team Sync',
        'Daily Standup Meeting', 'Standup Meeting'
      ];
      
      if (commonPhrases.includes(match)) {
        return match;
      }
      
      return this.anonymizer.getAnonymizedProject(match);
    });
    
    return sanitized;
  }

  /**
   * Sanitize extended properties
   */
  sanitizeExtendedProperties(extendedProps) {
    const sanitized = {};

    // Remove private properties entirely for safety, but keep empty object structure
    if (extendedProps.private) {
      sanitized.private = {};
    }

    if (extendedProps.shared) {
      sanitized.shared = {};
      Object.keys(extendedProps.shared).forEach(key => {
        const value = extendedProps.shared[key];
        if (!this.containsSensitiveData(value)) {
          sanitized.shared[key] = value;
        }
      });
    }

    return sanitized;
  }

  /**
   * Check if data contains sensitive information
   */
  containsSensitiveData(data) {
    if (!data) return false;
    
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const textLower = text.toLowerCase();
    
    // Check for emails
    if (text.includes('@') && !text.includes('PERSON_') && !text.includes('_ORG_')) {
      return true;
    }
    
    // Check for phone numbers
    if (/\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text)) {
      return true;
    }
    
    // Check for URLs
    if (/https?:\/\//.test(text)) {
      return true;
    }
    
    // Check for meeting IDs (long number sequences)
    if (/\b\d{9,}\b/.test(text)) {
      return true;
    }
    
    // Check for sensitive keywords
    const hasSensitiveKeywords = this.sensitiveKeywords.some(keyword => 
      textLower.includes(keyword)
    );
    
    // Check for sensitive patterns
    const hasSensitivePatterns = this.sensitivePatterns.some(pattern => 
      pattern.test(text)
    );
    
    return hasSensitiveKeywords || hasSensitivePatterns;
  }

  /**
   * Generate anonymous event ID
   */
  generateAnonymousId() {
    return `anon_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate anonymous UID
   */
  generateAnonymousUID() {
    return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@anonymized.cal`;
  }

  /**
   * Sanitize a batch of events
   */
  sanitizeEvents(events, options = {}) {
    return events.map(event => this.sanitizeEvent(event, options));
  }

  /**
   * Create minimal safe data for OpenAI
   */
  createMinimalSafeData(events, options = {}) {
    // For AI analysis, only include essential scheduling fields
    const allowedFields = [
      'start', 'end', 'summary', // Keep summary for meeting context
      'attendees', 'status', 'transparency' // Essential for availability calculation
      // Removed: description, location, extendedProperties, created, updated, creator, organizer, visibility, recurrence
    ];

    return events.map(event => {
      const sanitizedEvent = this.sanitizeEvent(event, options);
      const minimal = {};

      allowedFields.forEach(field => {
        if (sanitizedEvent[field] !== undefined) {
          minimal[field] = sanitizedEvent[field];
        }
      });

      // Add compact metadata for analysis
      minimal.metadata = {
        duration: this.calculateDuration(sanitizedEvent.start, sanitizedEvent.end),
        attendeeCount: sanitizedEvent.attendees ? sanitizedEvent.attendees.length : 0,
        isAllDay: !!(sanitizedEvent.start && sanitizedEvent.start.date) // vs dateTime
        // Removed: hasAttendees, isRecurring, dayOfWeek (can be calculated if needed)
      };

      return minimal;
    });
  }

  /**
   * Calculate event duration in minutes
   */
  calculateDuration(start, end) {
    if (!start || !end) return null;

    const startTime = new Date(start.dateTime || start.date);
    const endTime = new Date(end.dateTime || end.date);
    
    return Math.round((endTime - startTime) / (1000 * 60));
  }

  /**
   * Map anonymized results back to original data
   */
  mapResultsBack(anonymizedResults) {
    return this.anonymizer.mapBackToOriginal(anonymizedResults);
  }

  /**
   * Get sanitization statistics
   */
  getSanitizationStats() {
    return {
      ...this.anonymizer.getStats(),
      conferenceProtectionActive: true
    };
  }

  /**
   * Reset anonymization mappings
   */
  reset() {
    this.anonymizer.reset();
  }

  /**
   * Validate that data is safe for external processing
   */
  validateSafety(data) {
    console.log('DEBUG: Validating safety for data:', JSON.stringify(data, null, 2).substring(0, 1000));
    const issues = [];
    
    const checkForUnsafeData = (obj, path = '') => {
      if (typeof obj === 'string') {
        // Check for email patterns
        if (obj.includes('@') && !obj.includes('PERSON_') && !obj.includes('_ORG_')) {
          console.log('DEBUG: Found unsafe email:', obj, 'at path:', path);
          issues.push(`Potential email found at ${path}: ${obj.substring(0, 30)}...`);
        }
        
        // Check for phone numbers
        if (/\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(obj)) {
          issues.push(`Potential phone number found at ${path}`);
        }
        
        // Check for URLs
        if (/https?:\/\/(?!.*REMOVED)/.test(obj)) {
          issues.push(`Potential URL found at ${path}`);
        }
      } else if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          checkForUnsafeData(obj[key], path ? `${path}.${key}` : key);
        });
      }
    };

    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        checkForUnsafeData(item, `[${index}]`);
      });
    } else {
      checkForUnsafeData(data);
    }

    return {
      isSafe: issues.length === 0,
      issues
    };
  }
}

module.exports = CalendarSanitizer;
