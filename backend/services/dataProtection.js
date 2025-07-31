/**
 * Main data protection service - orchestrates all anonymization and sanitization
 */

const CalendarSanitizer = require('./calendarSanitizer');
const ConferenceProtection = require('./conferenceProtection');

class DataProtectionService {
  constructor(options = {}) {
    this.calendarSanitizer = new CalendarSanitizer();
    this.conferenceProtection = new ConferenceProtection();
    
    this.options = {
      strictMode: options.strictMode || false,
      allowMinimalLocation: options.allowMinimalLocation !== false,
      preserveTimePatterns: options.preserveTimePatterns !== false,
      enableLogging: options.enableLogging || false,
      ...options
    };

    this.processingStats = {
      eventsProcessed: 0,
      sensitiveDataRemoved: 0,
      conferenceDataRemoved: 0,
      attendeesAnonymized: 0,
      lastProcessed: null
    };
  }

  /**
   * Main method: Process calendar data for safe OpenAI transmission
   */
  async processCalendarData(calendarData, protectionLevel = 'STANDARD') {
    try {
      this.log('Starting calendar data processing', { protectionLevel });
      
      const startTime = Date.now();
      
      // Validate input
      if (!calendarData || (!Array.isArray(calendarData) && !calendarData.items)) {
        throw new Error('Invalid calendar data format');
      }

      // Extract events array
      const events = Array.isArray(calendarData) ? calendarData : calendarData.items || [];
      
      if (events.length === 0) {
        this.log('No events to process');
        return { safeData: [], stats: this.processingStats };
      }

      // Apply protection based on level
      let processedData;
      switch (protectionLevel) {
        case 'MINIMAL':
          processedData = this.applyMinimalProtection(events);
          break;
        case 'STANDARD':
          processedData = this.applyStandardProtection(events);
          break;
        case 'MAXIMUM':
          processedData = this.applyMaximumProtection(events);
          break;
        default:
          throw new Error(`Unknown protection level: ${protectionLevel}`);
      }

      // Final safety validation
      const safetyCheck = this.validateDataSafety(processedData);
      if (!safetyCheck.isSafe) {
        if (this.options.strictMode) {
          throw new Error(`Data safety validation failed: ${safetyCheck.issues.join(', ')}`);
        } else {
          this.log('Safety validation warnings', safetyCheck.issues);
        }
      }

      // Update statistics
      this.updateProcessingStats(events, processedData);
      
      const processingTime = Date.now() - startTime;
      this.log('Calendar data processing completed', { 
        processingTime, 
        eventsProcessed: events.length,
        protectionLevel 
      });

      return {
        safeData: processedData,
        stats: this.processingStats,
        protectionLevel,
        processingTime,
        safetyValidation: safetyCheck
      };

    } catch (error) {
      this.log('Error processing calendar data', error);
      throw new Error(`Data protection failed: ${error.message}`);
    }
  }

  /**
   * Apply minimal protection (basic conference data removal)
   */
  applyMinimalProtection(events) {
    this.log('Applying minimal protection');
    
    return events.map(event => {
      // Only remove conference data, keep everything else
      return this.conferenceProtection.sanitizeEvent(event);
    });
  }

  /**
   * Apply standard protection (full sanitization with anonymization)
   */
  applyStandardProtection(events) {
    this.log('Applying standard protection');
    
    return this.calendarSanitizer.createMinimalSafeData(events, {
      preserveSemanticMeaning: true,
      anonymizeAttendees: true,
      sanitizeContent: true
    });
  }

  /**
   * Apply maximum protection (aggressive anonymization)
   */
  applyMaximumProtection(events) {
    this.log('Applying maximum protection');
    
    const sanitized = this.calendarSanitizer.createMinimalSafeData(events, {
      preserveSemanticMeaning: false,
      anonymizeAttendees: true,
      sanitizeContent: true,
      stripDescriptions: true
    });

    // Additional aggressive filtering
    return sanitized.map(event => ({
      start: event.start,
      end: event.end,
      summary: this.aggressiveContentSanitization(event.summary),
      metadata: {
        hasAttendees: event.metadata.hasAttendees,
        duration: event.metadata.duration,
        dayOfWeek: event.metadata.dayOfWeek,
        isRecurring: event.metadata.isRecurring
      }
    }));
  }

  /**
   * Aggressive content sanitization for maximum protection
   */
  aggressiveContentSanitization(content) {
    if (!content) return content;
    
    // Handle specific multi-word patterns first
    const multiWordPatterns = {
      'daily standup meeting': 'MEETING_TYPE_C',
      'standup meeting': 'MEETING_TYPE_C',
      'team meeting': 'MEETING_TYPE_A',
      'board meeting': 'MEETING_TYPE_D'
    };
    
    let sanitized = content.toLowerCase();
    
    // Apply multi-word patterns first
    Object.keys(multiWordPatterns).forEach(pattern => {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      sanitized = sanitized.replace(regex, multiWordPatterns[pattern]);
    });
    
    // Then apply single-word patterns only if not already replaced
    const singleWordTerms = {
      'meeting': 'MEETING_TYPE_A',
      'call': 'MEETING_TYPE_B', 
      'standup': 'MEETING_TYPE_C',
      'review': 'MEETING_TYPE_D',
      'sync': 'MEETING_TYPE_E',
      'demo': 'MEETING_TYPE_F',
      'interview': 'MEETING_TYPE_G'
    };

    Object.keys(singleWordTerms).forEach(term => {
      // Only replace if not part of a MEETING_TYPE pattern already
      if (!sanitized.includes('MEETING_TYPE_')) {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        sanitized = sanitized.replace(regex, singleWordTerms[term]);
      }
    });

    return sanitized;
  }

  /**
   * Process OpenAI results and map back to original data
   */
  async processOpenAIResults(results, originalMapping) {
    try {
      this.log('Processing OpenAI results for mapping back');
      
      // Map anonymized results back to original identifiers
      const mappedResults = this.calendarSanitizer.mapResultsBack(results);
      
      // Apply any additional result processing
      return {
        mappedResults,
        processingStats: this.processingStats
      };
      
    } catch (error) {
      this.log('Error processing OpenAI results', error);
      throw new Error(`Result mapping failed: ${error.message}`);
    }
  }

  /**
   * Validate data safety before transmission
   */
  validateDataSafety(data) {
    const issues = [];
    
    // Use calendar sanitizer's validation
    const sanitizerValidation = this.calendarSanitizer.validateSafety(data);
    issues.push(...sanitizerValidation.issues);
    
    // Additional validations
    const additionalChecks = this.performAdditionalSafetyChecks(data);
    issues.push(...additionalChecks);
    
    return {
      isSafe: issues.length === 0,
      issues
    };
  }

  /**
   * Additional safety checks
   */
  performAdditionalSafetyChecks(data) {
    const issues = [];
    
    const checkData = (obj, path = '') => {
      if (typeof obj === 'string') {
        // Check for social security numbers
        if (/\b\d{3}-\d{2}-\d{4}\b/.test(obj)) {
          issues.push(`Potential SSN found at ${path}`);
        }
        
        // Check for credit card numbers
        if (/\b(?:\d{4}[-\s]?){3}\d{4}\b/.test(obj)) {
          issues.push(`Potential credit card number found at ${path}`);
        }
        
        // Check for IP addresses
        if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(obj)) {
          issues.push(`Potential IP address found at ${path}`);
        }
        
        // Check for file paths (but exclude timezone names and sanitized content)
        const isTimeZone = /^[A-Z][a-z]+\/[A-Z_a-z]+$/.test(obj);
        const isSanitized = obj.includes('[MEETING_INFO_REMOVED]') || obj.includes('[PHONE_REMOVED]') || obj.includes('[CODE_REMOVED]');
        if (!isTimeZone && !isSanitized && (/[C-Z]:\\[\w\\]+/.test(obj) || /\/[\w\/]+/.test(obj))) {
          issues.push(`Potential file path found at ${path}`);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          checkData(item, `${path}[${index}]`);
        });
      } else if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          checkData(obj[key], path ? `${path}.${key}` : key);
        });
      }
    };
    
    checkData(data);
    return issues;
  }

  /**
   * Update processing statistics
   */
  updateProcessingStats(originalEvents, processedEvents) {
    this.processingStats.eventsProcessed += originalEvents.length;
    this.processingStats.lastProcessed = new Date().toISOString();
    
    // Count anonymized attendees
    originalEvents.forEach(event => {
      if (event.attendees) {
        this.processingStats.attendeesAnonymized += event.attendees.length;
      }
    });
    
    // Estimate removed data
    originalEvents.forEach((original, index) => {
      const processed = processedEvents[index];
      if (processed) {
        // Count conference data removal
        if (original.conferenceData && !processed.conferenceData?.entryPoints) {
          this.processingStats.conferenceDataRemoved++;
        }
        
        // Count sensitive data removal (simplified estimation)
        const originalText = (original.summary || '') + (original.description || '');
        const processedText = (processed.summary || '') + (processed.description || '');
        
        if (originalText.length > processedText.length + 50) {
          this.processingStats.sensitiveDataRemoved++;
        }
      }
    });
  }

  /**
   * Get current protection statistics
   */
  getProtectionStats() {
    return {
      ...this.processingStats,
      sanitizerStats: this.calendarSanitizer.getSanitizationStats(),
      options: this.options
    };
  }

  /**
   * Reset all protection data and statistics
   */
  reset() {
    this.calendarSanitizer.reset();
    this.processingStats = {
      eventsProcessed: 0,
      sensitiveDataRemoved: 0,
      conferenceDataRemoved: 0,
      attendeesAnonymized: 0,
      lastProcessed: null
    };
    this.log('Data protection service reset');
  }

  /**
   * Configure protection options
   */
  configure(options) {
    this.options = { ...this.options, ...options };
    this.log('Protection options updated', this.options);
  }

  /**
   * Logging utility
   */
  log(message, data = null) {
    if (this.options.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[DataProtection ${timestamp}] ${message}`, data ? data : '');
    }
  }

  /**
   * Create a pre-configured instance for production use
   */
  static createProductionInstance() {
    return new DataProtectionService({
      strictMode: true,
      enableLogging: false,
      allowMinimalLocation: true,
      preserveTimePatterns: true
    });
  }

  /**
   * Create a pre-configured instance for development/testing
   */
  static createDevelopmentInstance() {
    return new DataProtectionService({
      strictMode: false,
      enableLogging: true,
      allowMinimalLocation: true,
      preserveTimePatterns: true
    });
  }
}

module.exports = DataProtectionService;
