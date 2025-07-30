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
    
    // Redirect to a special URL that the extension can detect
    const encodedData = encodeURIComponent(JSON.stringify(authData));
    res.redirect(`https://cal9000.onrender.com/auth/extension-success?data=${encodedData}`);
  }
);

// Extension success detection page
router.get('/extension-success', (req, res) => {
  const data = req.query.data;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Auth Complete</title></head>
    <body>
      <div style="font-family: system-ui; text-align: center; padding: 20px;">
        <h2 style="color: #28a745;">✅ Authentication Complete</h2>
        <p>You can close this window.</p>
      </div>
      <script>
        console.log('🎯 Extension success page loaded');
        
        // This URL can be detected by the extension
        console.log('Auth data available in URL params');
        
        // Auto-close after 1 second
        setTimeout(() => {
          window.close();
        }, 1000);
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
