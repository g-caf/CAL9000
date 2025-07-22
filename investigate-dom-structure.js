// Investigate DOM Structure
// Find out how events are actually nested and what date attributes exist

function investigateDOMStructure() {
  console.log('🔬 Investigating DOM Structure...');
  console.log('=================================');
  
  // Find a specific event we can see ("Weekly CEO Team" or similar)
  const allElements = Array.from(document.querySelectorAll('*'));
  const weeklyMeetingElement = allElements.find(el => 
    el.textContent?.includes('Weekly CEO') || 
    el.textContent?.includes('Company meeting') ||
    el.textContent?.includes('CEO Team')
  );
  
  if (weeklyMeetingElement) {
    console.log('📍 Found target event:', weeklyMeetingElement.textContent?.trim());
    console.log('Element:', weeklyMeetingElement);
    
    // Walk up the DOM tree to find date-related attributes
    let current = weeklyMeetingElement;
    let level = 0;
    
    console.log('\n🏗️ DOM HIERARCHY ANALYSIS:');
    console.log('==========================');
    
    while (current && level < 10) {
      const attributes = Array.from(current.attributes || []).map(attr => 
        `${attr.name}="${attr.value}"`
      );
      
      console.log(`Level ${level}:`, {
        tagName: current.tagName,
        className: current.className,
        id: current.id,
        textContent: current.textContent?.trim()?.substring(0, 50),
        attributes: attributes.filter(attr => 
          attr.includes('date') || 
          attr.includes('slot') || 
          attr.includes('key') ||
          attr.includes('20250630') ||
          attr.includes('2025-06-30')
        ),
        element: current
      });
      
      current = current.parentElement;
      level++;
    }
    
    // Also check siblings and nearby elements for date info
    console.log('\n🔍 NEARBY ELEMENTS WITH DATE INFO:');
    console.log('==================================');
    
    const nearbyElements = Array.from(weeklyMeetingElement.parentElement?.parentElement?.querySelectorAll('*') || []);
    nearbyElements.forEach((el, i) => {
      if (i > 20) return; // Limit output
      
      const hasDateInfo = Array.from(el.attributes || []).some(attr => 
        attr.name.includes('date') || 
        attr.value.includes('2025') ||
        attr.value.includes('20250630')
      );
      
      if (hasDateInfo) {
        const dateAttrs = Array.from(el.attributes || []).filter(attr => 
          attr.name.includes('date') || 
          attr.value.includes('2025') ||
          attr.value.includes('20250630')
        );
        
        console.log(`Nearby element with date:`, {
          text: el.textContent?.trim()?.substring(0, 30),
          dateAttributes: dateAttrs.map(attr => `${attr.name}="${attr.value}"`),
          element: el
        });
      }
    });
    
  } else {
    console.log('❌ Could not find target event element');
    
    // Fallback: look for any elements with date attributes
    console.log('\n🔍 SEARCHING FOR DATE ATTRIBUTES:');
    console.log('=================================');
    
    const elementsWithDates = allElements.filter(el => {
      return Array.from(el.attributes || []).some(attr => 
        attr.name.includes('date') || 
        attr.value.includes('2025') ||
        attr.value.includes('20250630') ||
        attr.value.includes('2025-06-30')
      );
    });
    
    console.log(`Found ${elementsWithDates.length} elements with date attributes`);
    elementsWithDates.slice(0, 10).forEach((el, i) => {
      const dateAttrs = Array.from(el.attributes || []).filter(attr => 
        attr.name.includes('date') || 
        attr.value.includes('2025') ||
        attr.value.includes('20250630') ||
        attr.value.includes('2025-06-30')
      );
      
      console.log(`Date element ${i}:`, {
        text: el.textContent?.trim()?.substring(0, 30),
        dateAttributes: dateAttrs.map(attr => `${attr.name}="${attr.value}"`),
        element: el
      });
    });
  }
  
  console.log('\n✅ Investigation complete!');
}

// Run the investigation
investigateDOMStructure();
