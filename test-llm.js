// Quick test of LLM parsing
const fetch = require('node-fetch');

async function testLLM() {
  try {
    const response = await fetch('https://cal9000.onrender.com/api/nlp/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "Can you find me 30 minutes with Quinn next week?"
      })
    });

    const result = await response.json();
    console.log('LLM Parse Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testLLM();
