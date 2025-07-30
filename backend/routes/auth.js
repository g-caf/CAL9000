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
    
    // For Chrome extension, we'll redirect to a success page that can communicate back
    const authData = {
      accessToken: req.user.accessToken,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      }
    };
    
    // Use URL fragment (hash) instead of query param for better security
    const encodedData = encodeURIComponent(JSON.stringify(authData));
    res.redirect(`/auth/success#token=${encodedData}`);
  }
);

// Success page (for Chrome extension communication)
router.get('/success', (req, res) => {
  // Set permissive headers for popup communication
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *; script-src 'unsafe-inline' *; object-src 'none';");
  
  // Token data will be in URL fragment, handled by client-side JS
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
        <br><br>
        <button id="close-btn" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
          Close Window
        </button>
      </div>
      <script>
        console.log('🎯 Auth success page loaded');
        
        // Extract token data from URL fragment
        const fragment = window.location.hash.substring(1);
        const params = new URLSearchParams(fragment);
        const tokenParam = params.get('token');
        
        if (!tokenParam) {
          console.error('❌ No token found in URL fragment');
          return;
        }
        
        let tokenData;
        try {
          tokenData = JSON.parse(decodeURIComponent(tokenParam));
          console.log('✅ Token data extracted:', tokenData);
        } catch (e) {
          console.error('❌ Failed to parse token data:', e);
          return;
        }
        
        // Generate unique session ID for this auth attempt
        const sessionId = 'auth_' + Date.now();
        console.log('Session ID:', sessionId);
        
        // Change the URL to include session ID for extension to detect
        const newUrl = window.location.origin + window.location.pathname + '?success=1&session=' + sessionId;
        history.replaceState({}, '', newUrl);
        console.log('🔄 URL changed to:', newUrl);
        
        // Store auth data for extension to pick up
        const authDataStr = JSON.stringify(tokenData);
        localStorage.setItem('calendar_auth_success', authDataStr);
        localStorage.setItem('calendar_auth_session', sessionId);
        
        // Try to set in opener window  
        if (window.opener) {
          try {
            window.opener.localStorage.setItem('calendar_auth_success', authDataStr);
            window.opener.localStorage.setItem('calendar_auth_session', sessionId);
            console.log('✅ Set localStorage in opener window');
          } catch (e) {
            console.log('❌ Could not set localStorage in opener:', e);
          }
        }
        
        // Send postMessage to parent window
        if (window.opener && !window.opener.closed) {
          console.log('📤 Sending postMessage to opener');
          try {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              data: authDataStr,
              sessionId: sessionId
            }, '*');
            console.log('✅ PostMessage sent successfully');
          } catch (e) {
            console.log('❌ PostMessage failed:', e);
          }
        } else {
          console.log('❌ No valid window.opener found');
        }
        
        // Auto-close after showing success message
        setTimeout(() => {
          console.log('🕒 Auto-closing window');
          window.close();
        }, 2000);
        
        // Also try manual close button
        document.addEventListener('click', (e) => {
          if (e.target.id === 'close-btn') {
            console.log('🔘 Close button clicked');
            // Try multiple ways to close
            try {
              window.close();
            } catch (err) {
              console.log('❌ window.close() failed:', err);
              // Try to close via opener
              if (window.opener) {
                window.opener.postMessage({ type: 'CLOSE_POPUP' }, '*');
              }
            }
          }
        });
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
