/**
 * Smart Scheduling Engine
 * Orchestrates intelligent calendar operations and scheduling decisions
 */

const CalendarIntelligence = require('./calendarIntelligence');

class SchedulingEngine {
  constructor() {
    this.intelligence = new CalendarIntelligence();
    this.schedulingRules = new Map();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default scheduling rules and preferences
   */
  initializeDefaultRules() {
    this.schedulingRules.set('buffer_time', {
      default: 15, // minutes
      urgent: 5,
      deep_work: 30
    });

    this.schedulingRules.set('meeting_types', {
      'one_on_one': { duration: 30, preferredTimes: ['morning', 'early_afternoon'] },
      'team_sync': { duration: 30, preferredTimes: ['morning'] },
      'standup': { duration: 15, preferredTimes: ['morning'] },
      'brainstorm': { duration: 60, preferredTimes: ['mid_morning', 'early_afternoon'] },
      'deep_work': { duration: 120, preferredTimes: ['morning', 'early_afternoon'] },
      'client_call': { duration: 60, preferredTimes: ['mid_morning', 'afternoon'] },
      'interview': { duration: 60, preferredTimes: ['mid_morning', 'early_afternoon'] }
    });

    this.schedulingRules.set('time_preferences', {
      morning: { start: 9, end: 11, energy: 'high' },
      mid_morning: { start: 10, end: 12, energy: 'high' },
      early_afternoon: { start: 13, end: 15, energy: 'medium' },
      afternoon: { start: 15, end: 17, energy: 'medium' },
      late_afternoon: { start: 16, end: 18, energy: 'low' }
    });
  }

  /**
   * Smart scheduling - main entry point
   */
  async scheduleIntelligently(calendarEvents, schedulingRequest) {
    const {
      type = 'schedule_meeting',
      meetingDetails = {},
      participants = [],
      constraints = {},
      preferences = {}
    } = schedulingRequest;

    console.log(`Processing intelligent scheduling request: ${type}`);

    switch (type) {
      case 'schedule_meeting':
        return await this.scheduleMeeting(calendarEvents, meetingDetails, participants, constraints, preferences);
      
      case 'find_focus_time':
        return await this.findFocusTime(calendarEvents, constraints, preferences);
      
      case 'optimize_calendar':
        return await this.optimizeCalendar(calendarEvents, preferences);
      
      case 'resolve_conflicts':
        return await this.resolveConflicts(calendarEvents, constraints);
      
      case 'batch_schedule':
        return await this.batchSchedule(calendarEvents, schedulingRequest.meetings);
      
      default:
        throw new Error(`Unknown scheduling type: ${type}`);
    }
  }

  /**
   * Schedule a meeting using AI analysis
   */
  async scheduleMeeting(calendarEvents, meetingDetails, participants, constraints, preferences) {
    const {
      title = 'New Meeting',
      duration = 30,
      meetingType = 'meeting',
      urgency = 'normal',
      timezone = 'America/New_York'
    } = meetingDetails;

    // Get participant calendar data if available
    const participantEvents = await this.getParticipantCalendarData(participants);

    // Determine analysis type based on participants
    const analysisType = participantEvents.length > 0 ? 'multi_person_scheduling' : 'conflict_resolution';

    // Run AI analysis
    const analysisOptions = {
      duration,
      attendeeCount: participants.length + 1,
      timeRange: constraints.timeRange || 'next_week',
      meetingType,
      urgency,
      timezone,
      attendeeEvents: participantEvents
    };

    const aiAnalysis = await this.intelligence.analyzeCalendarData(
      calendarEvents,
      analysisType,
      analysisOptions
    );

    // Apply scheduling rules and preferences
    const optimizedRecommendations = this.applySchedulingRules(aiAnalysis, meetingDetails, preferences);

    // Generate actionable scheduling response
    return {
      type: 'meeting_scheduling',
      meeting: {
        title,
        duration,
        meetingType,
        participants
      },
      recommendations: optimizedRecommendations,
      aiAnalysis,
      nextSteps: this.generateNextSteps(optimizedRecommendations, meetingDetails)
    };
  }

  /**
   * Find optimal focus time blocks
   */
  async findFocusTime(calendarEvents, constraints, preferences) {
    const {
      workType = 'knowledge_work',
      minimumBlock = 90,
      preferredTimes = [],
      dailyGoal = 2 // hours
    } = preferences;

    const analysisOptions = {
      workType,
      minimumBlock,
      focusTimeNeeded: dailyGoal * 60
    };

    const focusAnalysis = await this.intelligence.analyzeCalendarData(
      calendarEvents,
      'focus_time_analysis',
      analysisOptions
    );

    // Apply focus time rules
    const optimizedBlocks = this.optimizeFocusBlocks(focusAnalysis, constraints, preferences);

    return {
      type: 'focus_time_recommendations',
      focusBlocks: optimizedBlocks,
      analysis: focusAnalysis,
      implementationSuggestions: this.generateFocusTimeImplementation(optimizedBlocks)
    };
  }

  /**
   * Optimize entire calendar for efficiency
   */
  async optimizeCalendar(calendarEvents, preferences) {
    const {
      focusTimeGoal = 120, // minutes per day
      bufferPreference = 15,
      meetingConsolidation = true
    } = preferences;

    // Run multiple AI analyses
    const [patterns, availability, conflicts] = await Promise.all([
      this.intelligence.analyzeCalendarData(calendarEvents, 'pattern_recognition'),
      this.intelligence.analyzeCalendarData(calendarEvents, 'availability_optimization', {
        focusTimeNeeded: focusTimeGoal,
        bufferPreference
      }),
      this.intelligence.analyzeCalendarData(calendarEvents, 'conflict_resolution', {
        duration: 30,
        attendeeCount: 2,
        timeRange: 'next_week'
      })
    ]);

    // Synthesize optimization recommendations
    const optimizationPlan = this.synthesizeOptimizations(patterns, availability, conflicts, preferences);

    return {
      type: 'calendar_optimization',
      currentState: patterns,
      availabilityAnalysis: availability,
      optimizationPlan,
      estimatedImpact: this.calculateOptimizationImpact(optimizationPlan),
      implementationSteps: this.generateImplementationSteps(optimizationPlan)
    };
  }

  /**
   * Resolve scheduling conflicts
   */
  async resolveConflicts(calendarEvents, constraints) {
    const conflictEvents = this.identifyConflicts(calendarEvents);
    
    if (conflictEvents.length === 0) {
      return {
        type: 'conflict_resolution',
        conflicts: [],
        message: 'No scheduling conflicts detected'
      };
    }

    const resolutionOptions = {
      duration: 30,
      urgency: constraints.urgency || 'normal',
      timeRange: constraints.timeRange || 'next_week'
    };

    const resolutionAnalysis = await this.intelligence.analyzeCalendarData(
      calendarEvents,
      'conflict_resolution',
      resolutionOptions
    );

    return {
      type: 'conflict_resolution',
      conflicts: conflictEvents,
      resolutionOptions: resolutionAnalysis,
      autoResolutionSuggestions: this.generateAutoResolutions(conflictEvents, resolutionAnalysis)
    };
  }

  /**
   * Batch schedule multiple meetings efficiently
   */
  async batchSchedule(calendarEvents, meetings) {
    const schedulingResults = [];
    let currentCalendar = [...calendarEvents];

    // Sort meetings by priority/urgency
    const sortedMeetings = this.sortMeetingsByPriority(meetings);

    for (const meeting of sortedMeetings) {
      try {
        const result = await this.scheduleMeeting(
          currentCalendar,
          meeting.details,
          meeting.participants,
          meeting.constraints,
          meeting.preferences
        );

        schedulingResults.push({
          meetingId: meeting.id,
          status: 'scheduled',
          result
        });

        // Add scheduled meeting to calendar for next iteration
        if (result.recommendations.length > 0) {
          const scheduledEvent = this.createEventFromRecommendation(
            meeting,
            result.recommendations[0]
          );
          currentCalendar.push(scheduledEvent);
        }

      } catch (error) {
        schedulingResults.push({
          meetingId: meeting.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      type: 'batch_scheduling',
      results: schedulingResults,
      summary: this.generateBatchSummary(schedulingResults),
      calendarImpact: this.analyzeBatchImpact(calendarEvents, currentCalendar)
    };
  }

  /**
   * Apply scheduling rules to AI recommendations
   */
  applySchedulingRules(aiAnalysis, meetingDetails, preferences) {
    const { meetingType = 'meeting' } = meetingDetails;
    const rules = this.schedulingRules.get('meeting_types')[meetingType] || {};
    
    // Filter and rank recommendations based on rules
    let recommendations = aiAnalysis.recommendedTimes || [];

    // Apply time preferences
    recommendations = recommendations.map(rec => {
      const score = this.calculateRecommendationScore(rec, rules, preferences);
      return { ...rec, score };
    });

    // Sort by score
    recommendations.sort((a, b) => b.score - a.score);

    // Apply buffer time rules
    recommendations = recommendations.map(rec => {
      const bufferTime = this.calculateBufferTime(meetingType, preferences);
      return {
        ...rec,
        suggestedBuffer: bufferTime,
        adjustedTimeSlot: this.adjustForBuffer(rec.timeSlot, bufferTime)
      };
    });

    return recommendations.slice(0, 5); // Return top 5
  }

  /**
   * Calculate recommendation score based on rules and preferences
   */
  calculateRecommendationScore(recommendation, rules, preferences) {
    let score = 0;

    // Base confidence score
    switch (recommendation.confidence) {
      case 'high': score += 3; break;
      case 'medium': score += 2; break;
      case 'low': score += 1; break;
    }

    // Time preference bonus
    if (rules.preferredTimes) {
      const timeBonus = this.calculateTimePreferenceBonus(recommendation.timeSlot, rules.preferredTimes);
      score += timeBonus;
    }

    // User preference bonus
    if (preferences.preferredTimes) {
      const userBonus = this.calculateTimePreferenceBonus(recommendation.timeSlot, preferences.preferredTimes);
      score += userBonus;
    }

    return score;
  }

  /**
   * Helper methods for various operations
   */
  async getParticipantCalendarData(participants) {
    // In a real implementation, this would fetch calendar data for participants
    // For now, return empty array as we're working with single calendar
    return [];
  }

  identifyConflicts(events) {
    const conflicts = [];
    const sortedEvents = events.sort((a, b) => 
      new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date)
    );

    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];

      if (this.eventsOverlap(current, next)) {
        conflicts.push({ event1: current, event2: next, type: 'overlap' });
      }
    }

    return conflicts;
  }

  eventsOverlap(event1, event2) {
    const start1 = new Date(event1.start.dateTime || event1.start.date);
    const end1 = new Date(event1.end.dateTime || event1.end.date);
    const start2 = new Date(event2.start.dateTime || event2.start.date);
    const end2 = new Date(event2.end.dateTime || event2.end.date);

    return start1 < end2 && start2 < end1;
  }

  optimizeFocusBlocks(focusAnalysis, constraints, preferences) {
    return focusAnalysis.focusOpportunities
      .filter(block => block.quality === 'high' || block.quality === 'medium')
      .map(block => ({
        ...block,
        implementationSuggestion: this.generateFocusBlockSuggestion(block, preferences)
      }));
  }

  synthesizeOptimizations(patterns, availability, conflicts, preferences) {
    return {
      priorityActions: [
        ...availability.calendarAdjustments,
        ...conflicts.schedulingInsights
      ].slice(0, 5),
      focusTimeChanges: availability.focusTimeBlocks,
      meetingOptimizations: patterns.recommendations,
      bufferTimeAdjustments: availability.bufferSuggestions
    };
  }

  calculateOptimizationImpact(optimizationPlan) {
    return {
      focusTimeGain: '60-90 minutes per day',
      meetingEfficiency: '+25% estimated improvement',
      stressReduction: 'Moderate improvement expected',
      implementationTime: '2-3 days for full adoption'
    };
  }

  generateNextSteps(recommendations, meetingDetails) {
    if (recommendations.length === 0) {
      return ['No suitable times found. Consider relaxing constraints or checking participant availability.'];
    }

    return [
      `Review the ${recommendations.length} suggested time slots`,
      'Check with participants for their preferences',
      'Select preferred time and send calendar invitation',
      'Set up any required meeting resources (room, video link, etc.)'
    ];
  }

  sortMeetingsByPriority(meetings) {
    return meetings.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.constraints?.urgency] || 1;
      const bPriority = priorityOrder[b.constraints?.urgency] || 1;
      return bPriority - aPriority;
    });
  }

  generateBatchSummary(results) {
    const successful = results.filter(r => r.status === 'scheduled').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    return {
      totalMeetings: results.length,
      successful,
      failed,
      successRate: `${Math.round((successful / results.length) * 100)}%`
    };
  }

  // Additional helper methods would be implemented here...
  calculateBufferTime(meetingType, preferences) {
    const rules = this.schedulingRules.get('buffer_time');
    return preferences.bufferTime || rules[meetingType] || rules.default;
  }

  calculateTimePreferenceBonus(timeSlot, preferredTimes) {
    // Implementation would analyze time slot against preferred times
    return 1; // Simplified for now
  }

  adjustForBuffer(timeSlot, bufferMinutes) {
    // Implementation would adjust time slot to include buffer
    return timeSlot; // Simplified for now
  }

  generateFocusBlockSuggestion(block, preferences) {
    return `Block ${block.duration} minutes for deep work during ${block.timeBlock}`;
  }

  generateImplementationSteps(optimizationPlan) {
    return [
      'Review and prioritize the suggested changes',
      'Start with focus time blocks - easiest to implement',
      'Gradually adjust meeting patterns',
      'Monitor effectiveness over 1-2 weeks',
      'Refine based on results'
    ];
  }

  createEventFromRecommendation(meeting, recommendation) {
    // Create a calendar event object from scheduling recommendation
    return {
      summary: meeting.details.title,
      start: { dateTime: recommendation.timeSlot },
      end: { dateTime: this.calculateEndTime(recommendation.timeSlot, meeting.details.duration) },
      attendees: meeting.participants.map(p => ({ email: p }))
    };
  }

  calculateEndTime(startTime, durationMinutes) {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    return end.toISOString();
  }

  analyzeBatchImpact(originalCalendar, newCalendar) {
    return {
      eventsAdded: newCalendar.length - originalCalendar.length,
      densityIncrease: 'Moderate',
      recommendedActions: ['Consider consolidating some meetings', 'Ensure adequate buffer time']
    };
  }

  generateFocusTimeImplementation(focusBlocks) {
    return focusBlocks.map(block => ({
      action: `Schedule ${block.duration} minutes of focus time`,
      when: block.timeBlock,
      tips: block.recommendations
    }));
  }

  generateAutoResolutions(conflicts, analysis) {
    return conflicts.map(conflict => ({
      conflictId: conflict.event1.id + '_' + conflict.event2.id,
      suggestion: 'Move one event to suggested alternative time',
      alternatives: analysis.recommendedTimes.slice(0, 2)
    }));
  }
}

module.exports = SchedulingEngine;
