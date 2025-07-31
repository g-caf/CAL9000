const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function parseCalendarQuery(message) {
  console.log('Parsing with LLM:', message);
  
  const prompt = `Parse this calendar query into JSON. Be precise with entity extraction and intent classification.

Query: "${message}"

Rules:
- Map "quinn", "sqs", "sg" → "sqs" 
- Map "my", "me", "i" → "adrienne"
- For scheduling requests, extract duration and person
- For availability checks, identify the person being asked about
- For meeting searches, identify person/company and meeting type

Return only valid JSON:
{
  "intent": "availability|meeting_search|scheduling|calendar_view",
  "person": "sqs|adrienne|null",
  "duration": "30 minutes|1 hour|null", 
  "dateRange": "today|tomorrow|next week|this week|null",
  "meetingType": "1:1|sync|standup|call|meeting|null",
  "companyName": "company name|null",
  "isPersonalQuery": true/false
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 200
    });

    const content = response.choices[0].message.content.trim();
    console.log('LLM response:', content);
    
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('Parsed result:', parsed);
    
    return parsed;
    
  } catch (error) {
    console.error('LLM parsing error:', error);
    
    // Fallback to simple regex for basic cases
    return fallbackParsing(message);
  }
}

function fallbackParsing(message) {
  console.log('Using fallback parsing for:', message);
  
  const lowerMessage = message.toLowerCase();
  
  // Simple fallbacks for critical cases
  if (lowerMessage.includes('looking for') && lowerMessage.includes('minutes')) {
    return {
      intent: 'scheduling',
      person: lowerMessage.includes('quinn') ? 'sqs' : null,
      duration: lowerMessage.match(/(\d+)\s+(minute|hour)s?/)?.[0] || null,
      dateRange: lowerMessage.includes('next week') ? 'next week' : null,
      meetingType: lowerMessage.includes('call') ? 'call' : 'meeting',
      companyName: null,
      isPersonalQuery: false
    };
  }
  
  return {
    intent: 'calendar_view',
    person: 'adrienne',
    duration: null,
    dateRange: null,
    meetingType: null,
    companyName: null,
    isPersonalQuery: true
  };
}

module.exports = {
  parseCalendarQuery
};
