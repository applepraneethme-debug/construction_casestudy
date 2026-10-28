const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { authenticate, getJwtSecret } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Helper to set cookies securely
 */
const setAuthCookies = (res, token, csrfToken) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Signed authentication token stored in secure HttpOnly cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Non-HttpOnly CSRF token readable by client to place in x-csrf-token header
  res.cookie('xsrf-token', csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 24 * 60 * 60 * 1000
  });
};

/**
 * 1. GET /api/auth/csrf-token - Generates a new CSRF token
 */
router.get('/csrf-token', (req, res) => {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('xsrf-token', csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.status(200).json({ csrfToken });
});

/**
 * 2. POST /api/auth/login - Authenticate user & issue signed JWT and CSRF cookies
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Both email and password are required.'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'This account has been deactivated. Please contact the company Owner.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      getJwtSecret(),
      { expiresIn: '24h' }
    );

    const csrfToken = crypto.randomBytes(24).toString('hex');

    setAuthCookies(res, token, csrfToken);

    res.status(200).json({
      message: 'Login successful',
      user: user.toJSON(),
      csrfToken,
      token // Provided for API/testing convenience
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login: ' + error.message });
  }
});

/**
 * 3. POST /api/auth/logout - Clear auth and CSRF cookies
 */
router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax'
  });

  res.clearCookie('xsrf-token', {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax'
  });

  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * 4. GET /api/auth/me - Retrieve currently authenticated user profile
 */
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({
    user: req.user.toJSON()
  });
});

module.exports = router;
