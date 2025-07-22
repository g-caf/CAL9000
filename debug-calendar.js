// Calendar Detection Debug Tool
// Run this in the browser console on Google Calendar to diagnose issues

function debugCalendarDetection() {
  console.log('🔍 Starting Calendar Detection Debug...');
  console.log('==========================================');
  
  // 1. Check if we're on Google Calendar
  const isCalendar = window.location.hostname === 'calendar.google.com';
  console.log('✅ On Google Calendar:', isCalendar);
  
  if (!isCalendar) {
    console.log('❌ Not on Google Calendar, stopping debug');
    return;
  }
  
  // 2. Test week date detection
  console.log('\n📅 WEEK DATE DETECTION:');
  console.log('========================');
  
  // Try to find column headers
  const columnHeaders = document.querySelectorAll('[role="columnheader"]');
  console.log('Column headers found:', columnHeaders.length);
  
  columnHeaders.forEach((header, i) => {
    console.log(`  Header ${i}: "${header.textContent?.trim()}" - Element:`, header);
  });
  
  // Try alternative day header selectors
  const altSelectors = [
    '.Lxx7f',
    '.cNTTKd', 
    '.uAKqid',
    '[data-viewkey="WEEK"] [class*="day"]',
    '*[class*="day"]'
  ];
  
  altSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Alternative selector "${selector}" found ${elements.length} elements`);
      elements.forEach((el, i) => {
        if (i < 5) { // Only log first 5
          console.log(`  ${i}: "${el.textContent?.trim()?.substring(0, 50)}"`, el);
        }
      });
    }
  });
  
  // 3. Test event detection
  console.log('\n🎯 EVENT DETECTION:');
  console.log('===================');
  
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
    '.rjuR8e',
    '.OcVpRe'
  ];
  
  let totalEvents = 0;
  eventSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Selector "${selector}" found ${elements.length} elements`);
      totalEvents += elements.length;
      
      // Log details of first few events
      elements.forEach((el, i) => {
        if (i < 3) {
          const rect = el.getBoundingClientRect();
          const text = el.textContent?.trim();
          const dataEventId = el.getAttribute('data-eventid');
          const dataTooltip = el.getAttribute('data-tooltip');
          const ariaLabel = el.getAttribute('aria-label');
          
          console.log(`  Event ${i}:`, {
            text: text?.substring(0, 50),
            dataEventId,
            dataTooltip,
            ariaLabel: ariaLabel?.substring(0, 50),
            bounds: `${Math.round(rect.width)}x${Math.round(rect.height)} at (${Math.round(rect.left)}, ${Math.round(rect.top)})`,
            element: el
          });
        }
      });
    }
  });
  
  console.log(`Total events found: ${totalEvents}`);
  
  // 4. Test colored element detection (fallback method)
  console.log('\n🌈 COLORED ELEMENT DETECTION:');
  console.log('==============================');
  
  const allElements = Array.from(document.querySelectorAll('*'));
  const coloredElements = allElements.filter(el => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const hasColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && 
                     style.backgroundColor !== 'transparent' &&
                     style.backgroundColor !== 'rgb(255, 255, 255)';
    const hasSize = rect.width > 20 && rect.height > 15;
    
    return hasColor && hasSize;
  });
  
  console.log(`Found ${coloredElements.length} colored elements`);
  
  // Show first 10 colored elements
  coloredElements.slice(0, 10).forEach((el, i) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const text = el.textContent?.trim();
    
    console.log(`  Colored ${i}:`, {
      text: text?.substring(0, 30),
      backgroundColor: style.backgroundColor,
      bounds: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
      element: el
    });
  });
  
  // 5. Find month/year info
  console.log('\n📆 MONTH/YEAR DETECTION:');
  console.log('=========================');
  
  const monthYearSelectors = [
    '.sh7Io', 
    '.t7mmSb', 
    '[jsname="M8Jgzd"]',
    'h1[data-font="Google Sans"]',
    '.VfPpkd-Bz112c-LgbsSe.yHy1rc.eT1oJ.mN1ivc',
    '[role="button"][aria-label*="2025"]',
    'h1',
    'button[aria-label*="2025"]'
  ];
  
  monthYearSelectors.forEach(selector => {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`Selector "${selector}" found: "${element.textContent?.trim()}"`, element);
    }
  });
  
  // 6. Test specific date parsing
  console.log('\n🔍 SPECIFIC TESTS:');
  console.log('==================');
  
  // Look for elements that might contain "30" (Monday in the visible calendar)
  const elementsWithNumbers = Array.from(document.querySelectorAll('*')).filter(el => {
    const text = el.textContent?.trim();
    return text && /^\d{1,2}$/.test(text) && parseInt(text) >= 29 && parseInt(text) <= 31;
  });
  
  console.log(`Found ${elementsWithNumbers.length} elements with numbers 29-31`);
  elementsWithNumbers.forEach((el, i) => {
    if (i < 10) {
      console.log(`  Number element ${i}: "${el.textContent}" -`, el);
    }
  });
  
  console.log('\n✅ Debug complete! Check the logs above for issues.');
  
  return {
    columnHeaders: columnHeaders.length,
    totalEvents,
    coloredElements: coloredElements.length,
    elementsWithNumbers: elementsWithNumbers.length
  };
}

// Run the debug
debugCalendarDetection();
