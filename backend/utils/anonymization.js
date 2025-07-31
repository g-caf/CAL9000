/**
 * Core anonymization utilities for calendar data protection
 */

class AnonymizationManager {
  constructor() {
    this.personMapping = new Map();
    this.organizationMapping = new Map();
    this.locationMapping = new Map();
    this.projectMapping = new Map();
    this.reverseMapping = new Map();
    this.personCounter = 0;
    this.orgCounter = 0;
    this.locationCounter = 0;
    this.projectCounter = 0;
  }

  /**
   * Generate consistent anonymized identifiers
   */
  getAnonymizedPerson(email, name = null) {
    const key = email || name;
    if (!key) return null;

    if (this.personMapping.has(key)) {
      return this.personMapping.get(key);
    }

    const anonymizedId = `PERSON_${++this.personCounter}`;
    this.personMapping.set(key, anonymizedId);
    this.reverseMapping.set(anonymizedId, { type: 'person', original: key });
    return anonymizedId;
  }

  getAnonymizedOrganization(domain) {
    if (!domain) return null;

    if (this.organizationMapping.has(domain)) {
      return this.organizationMapping.get(domain);
    }

    // Classify organization type
    let orgType = 'EXTERNAL_ORG';
    if (this.isClientDomain(domain)) {
      orgType = 'CLIENT_FIRM';
    } else if (this.isInternalDomain(domain)) {
      orgType = 'OUR_COMPANY';
    } else if (this.isVendorDomain(domain)) {
      orgType = 'VENDOR';
    }

    const anonymizedId = `${orgType}_${++this.orgCounter}`;
    this.organizationMapping.set(domain, anonymizedId);
    this.reverseMapping.set(anonymizedId, { type: 'organization', original: domain });
    return anonymizedId;
  }

  getAnonymizedLocation(location) {
    if (!location) return null;

    if (this.locationMapping.has(location)) {
      return this.locationMapping.get(location);
    }

    // Preserve general location type while anonymizing specifics
    const locationType = this.classifyLocation(location);
    const anonymizedId = `${locationType}_${++this.locationCounter}`;
    this.locationMapping.set(location, anonymizedId);
    this.reverseMapping.set(anonymizedId, { type: 'location', original: location });
    return anonymizedId;
  }

  getAnonymizedProject(projectName) {
    if (!projectName) return null;

    if (this.projectMapping.has(projectName)) {
      return this.projectMapping.get(projectName);
    }

    const anonymizedId = `PROJECT_${++this.projectCounter}`;
    this.projectMapping.set(projectName, anonymizedId);
    this.reverseMapping.set(anonymizedId, { type: 'project', original: projectName });
    return anonymizedId;
  }

  /**
   * Classify location type while preserving semantic meaning
   */
  classifyLocation(location) {
    const locationLower = location.toLowerCase();
    
    if (locationLower.includes('zoom') || locationLower.includes('teams') || 
        locationLower.includes('meet') || locationLower.includes('webex')) {
      return 'VIRTUAL_MEETING';
    }
    
    if (locationLower.includes('conference') || locationLower.includes('room')) {
      return 'CONFERENCE_ROOM';
    }
    
    if (locationLower.includes('office') || locationLower.includes('building')) {
      return 'OFFICE_LOCATION';
    }
    
    if (locationLower.includes('restaurant') || locationLower.includes('cafe') || 
        locationLower.includes('coffee')) {
      return 'DINING_LOCATION';
    }
    
    return 'GENERAL_LOCATION';
  }

  /**
   * Domain classification helpers
   */
  isClientDomain(domain) {
    const clientDomains = [
      // Add known client domains here
      'bigcorp.com', 'enterprise.com'
    ];
    return clientDomains.includes(domain);
  }

  isInternalDomain(domain) {
    const internalDomains = [
      // Add your company domains here
      'yourcompany.com', 'internal.com'
    ];
    return internalDomains.includes(domain);
  }

  isVendorDomain(domain) {
    const vendorDomains = [
      'zoom.us', 'microsoft.com', 'google.com', 'slack.com'
    ];
    return vendorDomains.includes(domain);
  }

  /**
   * Reverse mapping to restore original data
   */
  mapBackToOriginal(anonymizedData) {
    if (typeof anonymizedData === 'string') {
      return this.reverseMapping.get(anonymizedData)?.original || anonymizedData;
    }

    if (Array.isArray(anonymizedData)) {
      return anonymizedData.map(item => this.mapBackToOriginal(item));
    }

    if (typeof anonymizedData === 'object' && anonymizedData !== null) {
      const result = {};
      for (const [key, value] of Object.entries(anonymizedData)) {
        result[key] = this.mapBackToOriginal(value);
      }
      return result;
    }

    return anonymizedData;
  }

  /**
   * Get anonymization statistics
   */
  getStats() {
    return {
      personsAnonymized: this.personMapping.size,
      organizationsAnonymized: this.organizationMapping.size,
      locationsAnonymized: this.locationMapping.size,
      projectsAnonymized: this.projectMapping.size
    };
  }

  /**
   * Clear all mappings (for testing or fresh start)
   */
  reset() {
    this.personMapping.clear();
    this.organizationMapping.clear();
    this.locationMapping.clear();
    this.projectMapping.clear();
    this.reverseMapping.clear();
    this.personCounter = 0;
    this.orgCounter = 0;
    this.locationCounter = 0;
    this.projectCounter = 0;
  }
}

module.exports = AnonymizationManager;
