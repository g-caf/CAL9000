const express = require('express');
const router = express.Router();
const { parseCalendarQuery } = require('../services/llm');

// Parse calendar query using LLM
router.post('/parse', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Received parse request:', message);
    
    const result = await parseCalendarQuery(message);
    
    res.json({
      success: true,
      parsed: result,
      originalMessage: message
    });
    
  } catch (error) {
    console.error('NLP parsing error:', error);
    res.status(500).json({ 
      error: 'Failed to parse message',
      details: error.message
    });
  }
});

module.exports = router;
