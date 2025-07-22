// Diagnose which events the extension finds vs. what's actually on the page
function diagnoseEventDetection() {
  console.log('🔬 Diagnosing Event Detection...');
  console.log('===============================');
  
  // First, find events we can visually see
  const allElements = Array.from(document.querySelectorAll('*'));
  
  const visibleEvents = [
    'Company meeting',
    'Weekly CEO Team',
    'Diego/Quinn',
    'FDE team meeting', 
    'Lori/Quinn',
    // Add more specific variations
    'Weekly CEO Team Sync',
    'Lori/Quinn 1-1',
    'Diego/Quinn 1-1',
    // Add unaccepted meeting
    'Outcast x Sourcegraph',
    'Outcast x Sourcegraph Weekly Call'
  ];
  
  console.log('\n📍 SEARCHING FOR VISIBLE EVENTS:');
  console.log('=================================');
  
  visibleEvents.forEach(eventName => {
    const found = allElements.find(el => 
      el.textContent?.includes(eventName)
    );
    
    if (found) {
      console.log(`✅ Found "${eventName}":`, {
        element: found,
        text: found.textContent?.trim(),
        tagName: found.tagName,
        classes: found.className,
        id: found.id,
        bounds: found.getBoundingClientRect(),
        attributes: Array.from(found.attributes || []).map(attr => `${attr.name}="${attr.value}"`)
      });
      
      // Show parent structure to understand hierarchy
      console.log(`   Parent chain for "${eventName}":`);
      let current = found;
      for (let i = 0; i < 3 && current; i++) {
        console.log(`     Level ${i}: <${current.tagName.toLowerCase()}${current.className ? ` class="${current.className}"` : ''}${current.id ? ` id="${current.id}"` : ''}>`);
        current = current.parentElement;
      }
      
      // Check if extension selectors would find this
      const extensionSelectors = [
        // NEW: Updated selectors based on current Google Calendar DOM
        '[data-eventchip]',
        '[data-start]',
        '[data-end]',
        '[jsname="XPtOyb"]',
        '[eventchip]',
        '[jsaction*="eventchip"]',
        'div[role="button"][jsname][data-eventchip]',
        '[class*="eventchip"]',
        '[tabindex="0"][aria-label][jsname]',
        '[aria-label*=":"]',
        '[title*=":"]',
        // Keep existing selectors for comparison
        '[data-eventid]',
        '.DM879e.Et1Dfe',
        '.lOneve',
        '.thflMc', 
        '.tkd8cb',
        '.P7r1if',
        '.uHlQvb.sQjuj',
        'button[data-eventid]',
        '[data-dragsource-type]',
        '[data-dateslot]',
        '[data-viewfamily="EVENT"]',
        '.DM879e',
        '.Et1Dfe'
      ];
      
      const matchingSelectors = extensionSelectors.filter(selector => {
        try {
          return found.matches && found.matches(selector);
        } catch {
          return false;
        }
      });
      
      console.log(`   Extension selectors that match: ${matchingSelectors.length > 0 ? matchingSelectors.join(', ') : 'NONE!'}`);
      
    } else {
      console.log(`❌ NOT found: "${eventName}"`);
    }
  });
  
  // Now check what the extension selectors actually find
  console.log('\n🎯 WHAT EXTENSION SELECTORS FIND:');
  console.log('==================================');
  
  const extensionSelectors = [
    // Test new selectors first
    '[data-eventchip]',
    '[jsname="XPtOyb"]',
    '[aria-label*=":"]',
    '[title*=":"]',
    // Then old selectors for comparison
    '[data-eventid]',
    '.DM879e.Et1Dfe',
    '.DM879e',
    '.Et1Dfe'
  ];
  
  extensionSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector "${selector}": ${elements.length} elements`);
    
    elements.forEach((el, i) => {
      if (i < 3) { // Only show first 3
        console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 40)}"`, el);
      }
    });
  });

  // Test the new smart text detection strategy
  console.log('\n🧠 SMART TEXT DETECTION TEST:');
  console.log('==============================');
  
  const eventCandidates = Array.from(document.querySelectorAll('*')).filter(el => {
    const text = el.textContent?.trim();
    const rect = el.getBoundingClientRect();
    
    // Must have reasonable size and be visible (relaxed constraints)
    if (!text || rect.width < 20 || rect.height < 10 || rect.width > 600 || rect.height > 150) {
      return false;
    }
    
    // Look for event-like text patterns
    const eventPatterns = [
      /Weekly CEO Team/i,
      /FDE team meeting/i,
      /Diego\/Quinn/i,
      /Lori\/Quinn/i,
      /Company meeting/i,
      /\b(meeting|call|sync|chat|standup|review|demo|training)\b/i,
      /\b(lunch|coffee|1:1|one.on.one)\b/i,
      /\d{1,2}:\d{2}\s*(am|pm)/i,
      /\w+\/\w+/,
    ];
    
    return eventPatterns.some(pattern => pattern.test(text));
  });
  
  console.log(`Smart text detection found: ${eventCandidates.length} candidates`);
  eventCandidates.slice(0, 5).forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 50)}" (${rect.width.toFixed(0)}x${rect.height.toFixed(0)})`, el);
  });

  // Debug: Try to find the visible events with very relaxed constraints
  console.log('\n🔍 DEBUG: LOOKING FOR SPECIFIC EVENTS WITH RELAXED CONSTRAINTS:');
  console.log('================================================================');
  
  visibleEvents.forEach(eventName => {
    const found = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.textContent?.trim();
      const rect = el.getBoundingClientRect();
      
      return text && 
             text.includes(eventName) && 
             rect.width > 10 && rect.height > 5 &&  // Very relaxed size constraints
             rect.width < 1000 && rect.height < 500; // Just avoid huge containers
    });
    
    console.log(`"${eventName}": ${found.length} elements found`);
    found.slice(0, 3).forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 60)}" (${rect.width.toFixed(0)}x${rect.height.toFixed(0)})`, el);
    });
  });
  
  // Additional analysis: Look for different event styling patterns
  console.log('\n🎨 EVENT STYLING ANALYSIS:');
  console.log('===========================');
  
  const colorPatterns = [
    { name: 'Orange events', color: 'rgb(251, 116, 0)' },
    { name: 'Blue events', color: 'rgb(66, 133, 244)' },
    { name: 'Purple events', color: 'rgb(156, 39, 176)' },
    { name: 'Green events', color: 'rgb(51, 182, 121)' }
  ];
  
  colorPatterns.forEach(({ name, color }) => {
    const coloredEvents = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return rect.width > 50 && rect.height > 20 && 
             (style.backgroundColor === color || 
              style.borderColor === color ||
              style.color === color);
    });
    
    console.log(`${name}: ${coloredEvents.length} elements`);
    coloredEvents.slice(0, 3).forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 50)}" (${rect.width.toFixed(0)}x${rect.height.toFixed(0)})`, el);
    });
  });

  // Skip collapsed events analysis - they're all-day events and irrelevant for scheduling

  // Test if we can find time patterns in different event structures  
  console.log('\n⏰ TIME PATTERN ANALYSIS:');
  console.log('==========================');
  
  const timeElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const text = el.textContent?.trim();
    const rect = el.getBoundingClientRect();
    return text && 
           /\d{1,2}:\d{2}\s*(am|pm)/i.test(text) &&
           rect.width > 20 && rect.height > 10;
  });
  
  console.log(`Found ${timeElements.length} elements with time patterns`);
  timeElements.slice(0, 8).forEach((el, i) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    console.log(`  ${i}: "${el.textContent?.trim()}" (${rect.width.toFixed(0)}x${rect.height.toFixed(0)}) bg: ${style.backgroundColor}`, el);
  });
  
  // Debug day column detection for events with same name
  console.log('\n📅 DAY COLUMN DETECTION ANALYSIS:');
  console.log('===================================');
  
  const loriQuinnEvents = Array.from(document.querySelectorAll('*')).filter(el => {
    return el.textContent?.includes('Lori/Quinn') && 
           el.getBoundingClientRect().width > 50;
  });
  
  console.log(`Found ${loriQuinnEvents.length} "Lori/Quinn" events`);
  
  // Get week day headers for reference
  const dayHeaders = Array.from(document.querySelectorAll('[role="columnheader"]')).slice(0, 7);
  console.log(`Week headers: ${dayHeaders.length} found`);
  
  dayHeaders.forEach((header, i) => {
    const rect = header.getBoundingClientRect();
    console.log(`  Day ${i}: "${header.textContent?.trim()}" at x=${rect.left.toFixed(0)}-${rect.right.toFixed(0)}`);
  });
  
  loriQuinnEvents.forEach((event, i) => {
    const rect = event.getBoundingClientRect();
    const text = event.textContent?.trim();
    console.log(`\nLori/Quinn event ${i}: "${text?.substring(0, 60)}"`);
    console.log(`  Position: x=${rect.left.toFixed(0)}-${rect.right.toFixed(0)}, y=${rect.top.toFixed(0)}-${rect.bottom.toFixed(0)}`);
    
    // Determine which day column this belongs to
    let assignedDay = -1;
    dayHeaders.forEach((header, dayIndex) => {
      const headerRect = header.getBoundingClientRect();
      const buffer = 10;
      if (rect.left >= headerRect.left - buffer && rect.left <= headerRect.right + buffer) {
        assignedDay = dayIndex;
      }
    });
    
    if (assignedDay >= 0) {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][assignedDay];
      console.log(`  Assigned to: Day ${assignedDay} (${dayName})`);
    } else {
      console.log(`  ❌ Could not assign to any day column!`);
    }
  });
  
  // Debug unaccepted/pending meetings
  console.log('\n❓ UNACCEPTED MEETINGS ANALYSIS:');
  console.log('================================');
  
  const outcastEvents = Array.from(document.querySelectorAll('*')).filter(el => {
    return el.textContent?.includes('Outcast') && 
           el.getBoundingClientRect().width > 50;
  });
  
  console.log(`Found ${outcastEvents.length} "Outcast" events`);
  
  outcastEvents.forEach((event, i) => {
    const rect = event.getBoundingClientRect();
    const style = window.getComputedStyle(event);
    const text = event.textContent?.trim();
    
    console.log(`\nOutcast event ${i}: "${text?.substring(0, 80)}"`);
    console.log(`  Position: x=${rect.left.toFixed(0)}-${rect.right.toFixed(0)}, y=${rect.top.toFixed(0)}-${rect.bottom.toFixed(0)}`);
    console.log(`  Style: bg=${style.backgroundColor}, opacity=${style.opacity}, color=${style.color}`);
    console.log(`  Classes: ${event.className}`);
    console.log(`  Attributes:`, Array.from(event.attributes || []).map(attr => `${attr.name}="${attr.value}"`));
    
    // Check if extension selectors match (updated with unaccepted meeting selectors)
    const extensionSelectors = [
      '[data-eventchip]',
      '[jsname="XPtOyb"]',
      '[aria-label*=":"]',
      '[title*=":"]',
      '[data-eventid]',
      // Unaccepted meeting selectors (comprehensive)
      '.fFwDnf', '.lhydbb', '.KcY3wb', '.IQUhYr', '.RlDtYe',
      '.mXmilvb', '.ogBSbf', '.u4si0c', '.j0nwNb', '.K2fuAf',
      '.pbeTDb', '.YoYtqb', '.nwPtud', '.eh5oYe', '.RumPDb',
      '.tkdBcb', '.oXZlyb', '.TBh5bd', '.uEzZIb'
    ];
    
    const matchingSelectors = extensionSelectors.filter(selector => {
      try {
        return event.matches && event.matches(selector);
      } catch {
        return false;
      }
    });
    
    console.log(`  Extension selectors that match: ${matchingSelectors.length > 0 ? matchingSelectors.join(', ') : 'NONE!'}`);
    
    // Check for "needs response" or "pending" indicators
    const parentText = event.parentElement?.textContent || '';
    const hasNeedsResponse = /needs\s+(response|rsvp)/i.test(parentText) || /needs\s+(response|rsvp)/i.test(text);
    console.log(`  Needs response indicator: ${hasNeedsResponse}`);
  });
  
  // Look for styling patterns that might indicate unaccepted meetings
  console.log('\n🎨 UNACCEPTED MEETING STYLING PATTERNS:');
  console.log('======================================');
  
  const potentialUnaccepted = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const text = el.textContent?.trim();
    
    return rect.width > 50 && rect.height > 15 && text &&
           (style.opacity < 1 || // Semi-transparent
            /needs.response/i.test(text) || // Contains "needs response"
            /pending/i.test(text) || // Contains "pending"
            style.textDecoration.includes('line-through')); // Crossed out
  });
  
  console.log(`Found ${potentialUnaccepted.length} potentially unaccepted events`);
  potentialUnaccepted.slice(0, 5).forEach((el, i) => {
    const style = window.getComputedStyle(el);
    console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 50)}" opacity=${style.opacity}`, el);
  });
  
  // SPECIAL DEBUGGING: Thursday phantom conflict
  console.log('\n👻 THURSDAY PHANTOM CONFLICT DEBUGGING:');
  console.log('=======================================');
  
  const thursdayColumn = 4; // Thursday is column 4 (0=Sun, 1=Mon, etc.)
  const thursday11AM = 11 * 60; // 11:00 AM in minutes
  const thursday11_15AM = 11 * 60 + 15; // 11:15 AM in minutes
  
  console.log(`Looking for phantom events on Thursday (column ${thursdayColumn}) around 11:00 AM`);
  
  // Get Thursday's header bounds
  if (dayHeaders.length >= 5) {
    const thursdayHeader = dayHeaders[thursdayColumn];
    const thursdayRect = thursdayHeader.getBoundingClientRect();
    
    console.log(`Thursday header bounds: ${thursdayRect.left.toFixed(0)} - ${thursdayRect.right.toFixed(0)}`);
    
    // Find all elements that overlap with Thursday column
    const thursdayElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const rect = el.getBoundingClientRect();
      const overlapsThursday = rect.left < thursdayRect.right + 10 && rect.right > thursdayRect.left - 10;
      const hasText = el.textContent?.trim().length > 0;
      const reasonableSize = rect.width > 20 && rect.height > 10;
      
      return overlapsThursday && hasText && reasonableSize;
    });
    
    console.log(`Found ${thursdayElements.length} elements in Thursday column`);
    
    // Filter for those that might contain time patterns around 11 AM
    const thursdsayTimeElements = thursdayElements.filter(el => {
      const text = el.textContent?.trim();
      return text && (
        /11:00|11am|11 am/i.test(text) ||
        /10:30.*11|11.*11:30/i.test(text) ||
        /\b11\b/i.test(text)
      );
    });
    
    console.log(`Found ${thursdsayTimeElements.length} Thursday elements mentioning 11 AM:`);
    thursdsayTimeElements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 80)}"`, {
        position: `${rect.left.toFixed(0)},${rect.top.toFixed(0)} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`,
        background: style.backgroundColor,
        color: style.color,
        opacity: style.opacity,
        element: el
      });
    });
    
    // Check ALL elements in Thursday column, not just time-related
    console.log(`\nALL Thursday column elements (first 10):`);
    thursdayElements.slice(0, 10).forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const text = el.textContent?.trim();
      console.log(`  ${i}: "${text?.substring(0, 50)}" (${rect.width.toFixed(0)}x${rect.height.toFixed(0)})`);
    });
  }
  
  console.log('\n✅ Diagnosis complete!');
}

// Run the diagnosis
diagnoseEventDetection();
