const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

// In-memory storage for session-based auth results
const authSessions = new Map();

// Start Google OAuth with session ID
router.get('/google', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }
  
  console.log('🚀 Starting OAuth for session:', sessionId);
  
  // Initiate Google OAuth with session ID in state parameter
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar'
    ],
    accessType: 'offline',
    prompt: 'consent',
    state: sessionId  // Pass session ID as state parameter
  })(req, res);
});

// Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    const sessionId = req.query.state;  // Get session ID from state parameter
    console.log('📞 OAuth callback - Session ID:', sessionId);
    console.log('✅ User authenticated:', !!req.user);
    console.log('🔍 Query params:', req.query);
    
    if (!sessionId) {
      console.log('❌ No session ID in callback');
      return res.redirect('/auth/failure');
    }
    
    if (req.user && req.user.accessToken) {
      // Store auth result by session ID
      authSessions.set(sessionId, {
        accessToken: req.user.accessToken,
        refreshToken: req.user.refreshToken,
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          picture: req.user.picture
        },
        createdAt: new Date(),
        status: 'success'
      });
      
      console.log('💾 Stored auth result for session:', sessionId);
      
      // Close the popup window
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Complete</title></head>
        <body>
          <div style="font-family: system-ui; text-align: center; padding: 20px;">
            <h2 style="color: #28a745;">✅ Authentication Complete!</h2>
            <p>You can close this window and return to the extension.</p>
          </div>
          <script>
            console.log('🎯 Auth success page loaded');
            setTimeout(() => {
              console.log('🔒 Closing auth popup');
              window.close();
            }, 2000);
          </script>
        </body>
        </html>
      `);
    } else {
      console.log('❌ No access token found');
      authSessions.set(sessionId, {
        status: 'error',
        error: 'No access token received',
        createdAt: new Date()
      });
      res.redirect('/auth/failure');
    }
  }
);

// Check auth status by session ID
router.get('/status/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  console.log('🔍 Status check for session:', sessionId);
  
  if (!authSessions.has(sessionId)) {
    console.log('⏳ Session pending:', sessionId);
    return res.json({ status: 'pending' });
  }
  
  const authData = authSessions.get(sessionId);
  console.log('📋 Found auth data:', authData.status);
  
  if (authData.status === 'success') {
    // Clean up the session data after successful retrieval
    authSessions.delete(sessionId);
    
    console.log('✅ Returning successful auth data');
    res.json({
      status: 'success',
      access_token: authData.accessToken,  // Use snake_case for compatibility
      refresh_token: authData.refreshToken,
      user: authData.user
    });
  } else {
    console.log('❌ Returning error status');
    res.json({
      status: 'error',
      error: authData.error || 'Authentication failed'
    });
  }
});

// Clean up old sessions (run periodically)
setInterval(() => {
  const now = new Date();
  for (const [sessionId, data] of authSessions.entries()) {
    if (now - data.createdAt > 10 * 60 * 1000) { // 10 minutes
      console.log('🧹 Cleaning up old session:', sessionId);
      authSessions.delete(sessionId);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Auth failure endpoint
router.get('/failure', (req, res) => {
  console.log('❌ Authentication failed');
  res.status(401).json({ error: 'Authentication failed' });
});

// Debug endpoint to test auth flow manually
router.get('/debug/:sessionId?', (req, res) => {
  const sessionId = req.params.sessionId || 'test123';
  console.log('🐛 Debug endpoint - available sessions:', Array.from(authSessions.keys()));
  
  res.json({
    requestedSession: sessionId,
    availableSessions: Array.from(authSessions.keys()),
    sessionData: authSessions.has(sessionId) ? 'EXISTS' : 'NOT_FOUND',
    totalSessions: authSessions.size,
    environment: {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
      redirectUri: process.env.GOOGLE_REDIRECT_URI
    }
  });
});

// Legacy token endpoint (for backward compatibility)
router.get('/token/:tempTokenId?', (req, res) => {
  console.log('⚠️ Legacy token endpoint called - use /status/:sessionId instead');
  res.status(404).json({ error: 'Endpoint deprecated - use /status/:sessionId' });
});

module.exports = router;
