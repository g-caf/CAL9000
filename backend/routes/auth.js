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
    
    // Store in session for polling approach
    req.session.googleTokens = authData;
    
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
          setTimeout(() => window.close(), 1000);
        </script>
      </body>
      </html>
    `);
  }
);

// Token endpoint for extension polling
router.get('/token', (req, res) => {
  if (req.session.googleTokens && req.session.googleTokens.accessToken) {
    res.json(req.session.googleTokens);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
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
