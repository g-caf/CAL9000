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
  ]
}));

// Google OAuth callback
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Successful authentication
    console.log('✅ OAuth callback successful for:', req.user.email);
    
    // For Chrome extension, we'll redirect to a success page that can communicate back
    res.redirect(`/auth/success?token=${encodeURIComponent(JSON.stringify({
      accessToken: req.user.accessToken,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      }
    }))}`);
  }
);

// Success page (for Chrome extension communication)
router.get('/success', (req, res) => {
  // Set permissive headers for popup communication
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *; script-src 'unsafe-inline' *; object-src 'none';");
  
  const token = req.query.token;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Successful</title>
      <style>
        body { font-family: system-ui; text-align: center; padding: 50px; background: #f0f8ff; }
        .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
        .instructions { color: #666; font-size: 14px; line-height: 1.5; }
        .token { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px; margin: 20px 0; word-break: break-all; }
      </style>
    </head>
    <body>
      <div class="success">✅ Successfully Connected to Google Calendar!</div>
      <div class="instructions">
        You can now close this window and return to your extension.
        <br><br>
        The extension should automatically detect the successful authentication.
      </div>
      <script>
        console.log('🎯 Auth success page loaded');
        console.log('Token data:', ${JSON.stringify(token)});
        
        // Generate unique session ID for this auth attempt
        const sessionId = 'auth_' + Date.now();
        console.log('Session ID:', sessionId);
        
        // Store auth data for extension to pick up (multiple strategies)
        localStorage.setItem('calendar_auth_success', ${JSON.stringify(token)});
        localStorage.setItem('calendar_auth_session', sessionId);
        
        // Try to set in opener window
        if (window.opener) {
          try {
            window.opener.localStorage.setItem('calendar_auth_success', ${JSON.stringify(token)});
            window.opener.localStorage.setItem('calendar_auth_session', sessionId);
            console.log('✅ Set localStorage in opener window');
          } catch (e) {
            console.log('❌ Could not set localStorage in opener:', e);
          }
        }
        
        // Also try setting in top window (if different)
        try {
          if (window.top !== window) {
            window.top.localStorage.setItem('calendar_auth_success', ${JSON.stringify(token)});
            window.top.localStorage.setItem('calendar_auth_session', sessionId);
            console.log('✅ Set localStorage in top window');
          }
        } catch (e) {
          console.log('❌ Could not set localStorage in top window:', e);
        }
        
        // Send postMessage to parent window
        if (window.opener) {
          console.log('📤 Sending postMessage to opener');
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            data: ${JSON.stringify(token)}
          }, '*');
        } else {
          console.log('❌ No window.opener found');
        }
        
        // Give extension time to detect success before auto-closing
        setTimeout(() => {
          console.log('🕒 Timeout reached, sending final message and closing');
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              data: ${JSON.stringify(token)}
            }, '*');
          }
          window.close();
        }, 3000); // Increased to 3 seconds
      </script>
    </body>
    </html>
  `);
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
