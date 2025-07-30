const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

// Initiate Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar'
  ],
  accessType: 'offline',
  prompt: 'consent' // Force consent screen every time
}));

// Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Successful authentication
    console.log('✅ OAuth callback successful for:', req.user.email);
    
    const authData = {
      accessToken: req.user.accessToken,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      }
    };
    
    // Generate a temporary token ID for cross-session sharing
    const tempTokenId = 'auth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store tokens temporarily in memory (you'd use Redis in production)
    global.tempTokens = global.tempTokens || {};
    global.tempTokens[tempTokenId] = {
      ...authData,
      createdAt: Date.now()
    };
    
    // Clean up old tokens (older than 10 minutes)
    Object.keys(global.tempTokens).forEach(id => {
      if (Date.now() - global.tempTokens[id].createdAt > 10 * 60 * 1000) {
        delete global.tempTokens[id];
      }
    });
    
    console.log('🔑 Stored temp token:', tempTokenId);
    
    // Send simple auto-close page
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
          console.log('🎯 Auth success page loaded, will close in 3 seconds');
          
          // Store temp token ID in localStorage for extension to find
          localStorage.setItem('cal9000_temp_token', '${tempTokenId}');
          console.log('💾 Stored temp token ID for extension:', '${tempTokenId}');
          
          setTimeout(() => {
            console.log('🔒 Closing auth popup');
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `);
  }
);

// Token endpoint for extension polling
router.get('/token/:tempTokenId?', (req, res) => {
  console.log('🔍 Token endpoint called');
  const tempTokenId = req.params.tempTokenId || req.query.tempTokenId;
  console.log('🔑 Looking for temp token:', tempTokenId);
  console.log('📦 Available temp tokens:', Object.keys(global.tempTokens || {}));
  
  if (tempTokenId && global.tempTokens && global.tempTokens[tempTokenId]) {
    console.log('✅ Found temp token, returning to extension');
    const tokenData = global.tempTokens[tempTokenId];
    
    // Clean up used token
    delete global.tempTokens[tempTokenId];
    
    res.json(tokenData);
  } else {
    console.log('❌ No temp token found');
    res.status(401).json({ 
      error: 'Not authenticated', 
      tempTokenId,
      availableTokens: Object.keys(global.tempTokens || {})
    });
  }
});

// Authentication failure
router.get('/failure', (req, res) => {
  res.status(401).json({
    error: 'Authentication failed',
    message: 'Google OAuth authentication was unsuccessful'
  });
});

// Check authentication status
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;
