const jwt = require('jsonwebtoken');

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware for JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// API Key validation middleware
const apiKeyMiddleware = (requiredPermissions = []) => {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide a valid API key in the x-api-key header or apiKey query parameter'
      });
    }

    // For this demo, we'll use predefined API keys
    // In production, these would be stored in a database with proper permissions
    const validApiKeys = {
      'admin-key-demo-123': ['admin'],
      'rider-key-demo-456': ['rider'],  
      'driver-key-demo-789': ['driver'],
      'master-key-demo-000': ['admin', 'rider', 'driver'] // Master key for all permissions
    };

    const keyPermissions = validApiKeys[apiKey];
    if (!keyPermissions) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    // Check if the key has required permissions
    const hasPermission = requiredPermissions.length === 0 || 
                         requiredPermissions.some(permission => keyPermissions.includes(permission));

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This API key does not have the required permissions: ${requiredPermissions.join(', ')}`
      });
    }

    // Add key info to request for logging/debugging
    req.apiKey = {
      key: apiKey,
      permissions: keyPermissions
    };

    next();
  };
};

module.exports = {
  authenticateToken,
  apiKeyMiddleware
};