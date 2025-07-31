const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');
const aiRoutes = require('./routes/ai');
const nlpRoutes = require('./routes/nlp');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for basic styling
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://www.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));

// Logging
app.use(morgan('combined'));

// Rate limiting to prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all requests
app.use(limiter);

// CORS configuration for Chrome extension
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow Chrome extensions - but will verify extension ID in middleware below
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow specific origins in development
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL_DEV
    ];
    
    // Only allow localhost in development
    if (process.env.NODE_ENV !== 'production') {
      allowedOrigins.push('http://localhost:3000', 'https://localhost:3000');
    }
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-ID']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // Prevent XSS token theft
    sameSite: 'lax', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Extension verification middleware
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  
  // Only verify Chrome extension requests
  if (origin && origin.startsWith('chrome-extension://')) {
    const extensionId = req.get('X-Extension-ID');
    const allowedExtensionIds = (process.env.ALLOWED_EXTENSION_IDS || '').split(',').filter(Boolean);
    
    // In development, allow any extension if no IDs configured
    if (process.env.NODE_ENV !== 'production' && allowedExtensionIds.length === 0) {
      console.log('Development mode: allowing extension request without ID verification');
      return next();
    }
    
    // In production, require valid extension ID
    if (!extensionId || !allowedExtensionIds.includes(extensionId)) {
      console.log('Blocked request from unauthorized extension:', extensionId);
      return res.status(403).json({ error: 'Unauthorized extension' });
    }
    
    console.log('Verified extension request from:', extensionId);
  }
  
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/nlp', nlpRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🗓️ Calendar Assistant Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth/*',
      calendar: '/api/calendar/*',
      ai: '/api/ai/*',
      nlp: '/api/nlp/*'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Calendar Assistant Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔑 Google OAuth: http://localhost:${PORT}/auth/google`);
});

module.exports = app;
