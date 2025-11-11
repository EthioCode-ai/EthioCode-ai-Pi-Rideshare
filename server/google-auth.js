
const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const database = require('./database');

// Initialize Google OAuth client
const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === 'production' 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
    : `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
);

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId: userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Initiate Google OAuth flow
router.get('/google', (req, res) => {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ],
    include_granted_scopes: true
  });

  res.redirect(authUrl);
});

// Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/rider/auth?error=oauth_cancelled');
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify the ID token and get user info
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const {
      sub: googleId,
      email,
      given_name: firstName,
      family_name: lastName,
      picture: profilePicture,
      email_verified: emailVerified
    } = payload;

    // Check if user already exists
    let user = await database.query(
      'SELECT * FROM users WHERE email = ? OR google_id = ?',
      [email, googleId]
    );

    if (user.length === 0) {
      // Create new user
      const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      await database.query(
        `INSERT INTO users (
          id, email, first_name, last_name, google_id, 
          profile_picture, email_verified, user_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'rider', NOW())`,
        [userId, email, firstName, lastName, googleId, profilePicture, emailVerified ? 1 : 0]
      );

      user = await database.query('SELECT * FROM users WHERE id = ?', [userId]);
    } else {
      // Update existing user with Google info if not already linked
      const existingUser = user[0];
      if (!existingUser.google_id) {
        await database.query(
          'UPDATE users SET google_id = ?, profile_picture = ?, email_verified = ? WHERE id = ?',
          [googleId, profilePicture, emailVerified ? 1 : 0, existingUser.id]
        );
      }
    }

    const userData = user[0];
    const token = generateToken(userData.id);

    // Create a temporary token to pass user data securely
    const tempToken = jwt.sign(
      { 
        token,
        user: {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          profilePicture: userData.profile_picture,
          emailVerified: userData.email_verified
        }
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '5m' }
    );

    // Redirect to frontend with success and temp token
    res.redirect(`/rider/auth?success=google_login&token=${tempToken}`);

  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect('/rider/auth?error=oauth_failed');
  }
});

// Endpoint to exchange temp token for user data
router.post('/google/exchange', async (req, res) => {
  const { tempToken } = req.body;

  if (!tempToken) {
    return res.status(400).json({ error: 'Temporary token required' });
  }

  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({
      success: true,
      token: decoded.token,
      user: decoded.user
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
