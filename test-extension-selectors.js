// Test Extension Selectors
// This tests the exact selectors used by the extension to see what events are found

function testExtensionSelectors() {
  console.log('🧪 Testing Extension Event Selectors...');
  console.log('=========================================');
  
  // These are the exact selectors from the updated extension
  const eventSelectors = [
    '[data-eventid]',
    // Current Google Calendar selectors (2025)
    '.lOneve',
    '.thflMc', 
    '.tkd8cb',
    '.P7r1if',
    '.uHlQvb.sQjuj',
    'button[data-eventid]',
    '[data-dragsource-type]',
    '[data-dateslot]',
    // Legacy selectors (fallback)
    '.EaCxIb', 
    '.bze0vd', 
    '[role="button"][data-tooltip]',
    '[role="button"][aria-label*=":"]',
    '.event',
    '.xJNT6',
    '[jsaction*="click"]:not([role="button"])',
    '.rjuR8e',
    '.OcVpRe'
  ];
  
  let allEvents = [];
  let selectorResults = {};
  
  eventSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      selectorResults[selector] = elements.length;
      
      if (elements.length > 0) {
        console.log(`✅ Selector "${selector}" found ${elements.length} elements`);
        
        elements.forEach((element, i) => {
          // Test the extension's extractEventData logic
          const eventData = testExtractEventData(element);
          if (eventData && !allEvents.some(e => e.element === element)) {
            allEvents.push(eventData);
            if (i < 3) {
              console.log(`  Event ${i}:`, {
                text: eventData.text?.substring(0, 30),
                date: eventData.date?.toDateString(),
                hasDate: !!eventData.date,
                dateKey: eventData.dateKey
              });
            }
          }
        });
      }
    } catch (error) {
      console.warn(`❌ Selector "${selector}" failed:`, error);
      selectorResults[selector] = 'ERROR';
    }
  });
  
  console.log('\n📊 SUMMARY:');
  console.log('============');
  console.log('Total unique events found:', allEvents.length);
  console.log('Events with dates:', allEvents.filter(e => e.date).length);
  console.log('Events without dates:', allEvents.filter(e => !e.date).length);
  
  // Show events that have dates and text (should be the real calendar events)
  const realEvents = allEvents.filter(e => e.date && e.text && e.text.trim().length > 0);
  console.log('\n🎯 REAL CALENDAR EVENTS:');
  console.log('=========================');
  realEvents.forEach((event, i) => {
    console.log(`${i + 1}. "${event.text}" on ${event.date.toDateString()}`);
  });
  
  if (realEvents.length === 0) {
    console.log('❌ NO REAL CALENDAR EVENTS DETECTED!');
    console.log('This means the extension will show everything as "available"');
  }
  
  return {
    totalEvents: allEvents.length,
    realEvents: realEvents.length,
    selectorResults
  };
}

// Test version of the extension's extractEventData function
function testExtractEventData(element) {
  const rect = element.getBoundingClientRect();
  const eventText = element.textContent?.trim() || '';
  const tooltip = element.getAttribute('data-tooltip') || element.title || '';
  
  // Look for date containers
  let dateContainer = element.closest('[data-datekey]') || element.closest('[data-dateslot]');
  let dateKey = dateContainer?.getAttribute('data-datekey') || dateContainer?.getAttribute('data-dateslot');
  
  if (dateKey) {
    let year, month, day;
    
    if (dateKey.length === 8 && /^\d{8}$/.test(dateKey)) {
      year = parseInt(dateKey.substring(0, 4));
      month = parseInt(dateKey.substring(4, 6)) - 1;
      day = parseInt(dateKey.substring(6, 8));
    } else if (dateKey.includes('-')) {
      const dateParts = dateKey.split('-');
      if (dateParts.length >= 3) {
        year = parseInt(dateParts[0]);
        month = parseInt(dateParts[1]) - 1;
        day = parseInt(dateParts[2]);
      }
    }
    
    if (year && month !== undefined && day) {
      return {
        element: element,
        date: new Date(year, month, day),
        text: eventText,
        tooltip: tooltip,
        bounds: rect,
        dateKey: dateKey
      };
    }
  }
  
  // Return event without date for debugging
  if (eventText.length > 0 && rect.width > 20 && rect.height > 15) {
    return {
      element: element,
      date: null,
      text: eventText,
      tooltip: tooltip,
      bounds: rect,
      dateKey: null
    };
  }
  
  return null;
}

// Run the test
testExtensionSelectors();
