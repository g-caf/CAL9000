/**
 * Conference data protection - removes all meeting credentials and access information
 */

class ConferenceProtection {
  constructor() {
    // Patterns for various conference platforms
    this.conferencePatterns = {
      zoom: [
        /https?:\/\/[\w-]+\.zoom\.us\/j\/\d+(\?[^\s]*)?/gi,
        /zoom\.us\/j\/\d+/gi,
        /meeting\s*id\s*:?\s*\d{9,11}/gi,
        /meeting\s*id\s*:?\s*\d{3}\s*\d{3}\s*\d{4}/gi,
        /passcode\s*:?\s*[\w\d]+/gi,
        /password\s*:?\s*[\w\d]+/gi,
        /dial\s*by\s*your\s*location[\s\S]*?find\s*your\s*local\s*number/gi,
        /one\s*tap\s*mobile[\s\S]*?\d+#/gi,
        /\*[\w\d]+#/gi
      ],
      teams: [
        /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s]+/gi,
        /https?:\/\/teams\.live\.com\/meet\/[^\s]+/gi,
        /conference\s*id\s*:?\s*\d+/gi,
        /phone\s*conference\s*id\s*:?\s*\d+/gi
      ],
      meet: [
        /https?:\/\/meet\.google\.com\/[a-z\-]+/gi,
        /meet\.google\.com\/[a-z\-]+/gi,
        /https?:\/\/g\.co\/meet\/[^\s]+/gi
      ],
      webex: [
        /https?:\/\/[\w-]+\.webex\.com\/meet\/[^\s]+/gi,
        /https?:\/\/[\w-]+\.webex\.com\/join\/[^\s]+/gi,
        /meeting\s*number\s*:?\s*\d+/gi,
        /access\s*code\s*:?\s*\d+/gi
      ],
      generic: [
        /join\s*by\s*phone[\s\S]*?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/gi,
        /dial\s*in[\s\S]*?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/gi,
        /\+?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}[\s\S]*?access\s*code/gi,
        /meeting\s*url\s*:?\s*https?:\/\/[^\s]+/gi,
        /join\s*url\s*:?\s*https?:\/\/[^\s]+/gi,
        /https?:\/\/[\w.-]+\.zoom\.us[^\s]*/gi,
        /https?:\/\/[\w.-]*zoom\.us[^\s]*/gi
      ]
    };

    // Phone number patterns
    this.phonePatterns = [
      /\+?1[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}/g
    ];

    // Conference-related keywords that might contain sensitive data
    this.sensitiveKeywords = [
      'meeting id', 'passcode', 'password', 'access code', 'conference id',
      'dial-in', 'phone number', 'pin', 'security code', 'host key'
    ];
  }

  /**
   * Remove all conference data from calendar event
   */
  sanitizeEvent(event) {
    const sanitized = { ...event };

    // Sanitize main fields
    sanitized.summary = this.removeConferenceData(event.summary || '');
    sanitized.description = this.removeConferenceData(event.description || '');
    sanitized.location = this.sanitizeLocation(event.location || '');

    // Remove conference data objects entirely
    if (sanitized.conferenceData) {
      sanitized.conferenceData = {
        conferenceType: 'VIRTUAL_MEETING',
        notes: 'Conference details removed for privacy'
      };
    }

    // Sanitize hangout link
    if (sanitized.hangoutLink) {
      delete sanitized.hangoutLink;
    }

    // Check for conference data in extended properties
    if (sanitized.extendedProperties) {
      sanitized.extendedProperties = this.sanitizeExtendedProperties(sanitized.extendedProperties);
    }

    return sanitized;
  }

  /**
   * Remove conference data from text content
   */
  removeConferenceData(text) {
    if (!text) return text;

    let sanitized = text;

    // Apply all conference platform patterns
    Object.values(this.conferencePatterns).forEach(patterns => {
      patterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[MEETING_INFO_REMOVED]');
      });
    });

    // Remove phone numbers in conference context
    this.phonePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[PHONE_REMOVED]');
    });

    // Remove lines containing sensitive keywords
    const lines = sanitized.split('\n');
    const filteredLines = lines.filter(line => {
      const lineLower = line.toLowerCase();
      return !this.sensitiveKeywords.some(keyword => 
        lineLower.includes(keyword) && this.containsCredentials(line)
      );
    });

    sanitized = filteredLines.join('\n');

    // Clean up multiple consecutive removed markers
    sanitized = sanitized.replace(/\[MEETING_INFO_REMOVED\]\s*\[MEETING_INFO_REMOVED\]/g, '[MEETING_INFO_REMOVED]');
    sanitized = sanitized.replace(/\[PHONE_REMOVED\]\s*\[PHONE_REMOVED\]/g, '[PHONE_REMOVED]');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Sanitize location field
   */
  sanitizeLocation(location) {
    if (!location) return location;

    // If location contains conference URLs or IDs, replace with generic indicator
    const sanitized = this.removeConferenceData(location);
    
    // If the entire location was conference data, provide generic replacement
    if (sanitized.includes('[MEETING_INFO_REMOVED]') || sanitized.trim().length === 0) {
      return 'Virtual Meeting';
    }

    return sanitized;
  }

  /**
   * Sanitize extended properties
   */
  sanitizeExtendedProperties(extendedProps) {
    const sanitized = { ...extendedProps };

    if (sanitized.private) {
      Object.keys(sanitized.private).forEach(key => {
        if (this.containsConferenceData(sanitized.private[key])) {
          delete sanitized.private[key];
        }
      });
    }

    if (sanitized.shared) {
      Object.keys(sanitized.shared).forEach(key => {
        if (this.containsConferenceData(sanitized.shared[key])) {
          delete sanitized.shared[key];
        }
      });
    }

    return sanitized;
  }

  /**
   * Check if text contains conference data
   */
  containsConferenceData(text) {
    if (!text) return false;

    const textLower = text.toLowerCase();
    
    // Check for conference URLs
    if (textLower.includes('zoom.us') || textLower.includes('teams.microsoft.com') ||
        textLower.includes('meet.google.com') || textLower.includes('webex.com')) {
      return true;
    }

    // Check for meeting credentials
    return this.sensitiveKeywords.some(keyword => textLower.includes(keyword));
  }

  /**
   * Check if line contains credentials (numbers, codes, etc.)
   */
  containsCredentials(line) {
    // Look for patterns that suggest credentials
    return /\d{6,}/.test(line) || // 6+ digit numbers (meeting IDs)
           /:\s*[A-Za-z0-9]{4,}/.test(line) || // Passcodes after colons
           /https?:\/\//.test(line); // URLs
  }

  /**
   * Validate that no conference data remains
   */
  validateSanitization(event) {
    const issues = [];
    
    const checkField = (fieldName, value) => {
      if (this.containsConferenceData(value)) {
        issues.push(`Conference data detected in ${fieldName}: ${value.substring(0, 50)}...`);
      }
    };

    checkField('summary', event.summary);
    checkField('description', event.description);
    checkField('location', event.location);

    if (event.conferenceData && event.conferenceData.entryPoints) {
      issues.push('Conference data object still contains entry points');
    }

    if (event.hangoutLink) {
      issues.push('Hangout link still present');
    }

    return {
      isClean: issues.length === 0,
      issues
    };
  }

  /**
   * Get statistics about sanitization
   */
  getSanitizationStats(originalEvent, sanitizedEvent) {
    const stats = {
      fieldsModified: [],
      conferenceDataRemoved: false,
      estimatedItemsRemoved: 0
    };

    if (originalEvent.summary !== sanitizedEvent.summary) {
      stats.fieldsModified.push('summary');
      stats.estimatedItemsRemoved += (originalEvent.summary.match(/\[MEETING_INFO_REMOVED\]/g) || []).length;
    }

    if (originalEvent.description !== sanitizedEvent.description) {
      stats.fieldsModified.push('description');
      stats.estimatedItemsRemoved += (originalEvent.description.match(/\[MEETING_INFO_REMOVED\]/g) || []).length;
    }

    if (originalEvent.location !== sanitizedEvent.location) {
      stats.fieldsModified.push('location');
    }

    if (originalEvent.conferenceData && !sanitizedEvent.conferenceData?.entryPoints) {
      stats.conferenceDataRemoved = true;
    }

    return stats;
  }
}

module.exports = ConferenceProtection;
