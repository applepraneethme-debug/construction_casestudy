const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { hasPermission } = require('../config/permissions');

const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'construction_casestudy_jwt_secret_dev_key';
};

/**
 * Authentication Middleware:
 * Verifies JWT token from HttpOnly cookie or Authorization header.
 * Attaches the authenticated User model instance to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Check Authorization Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        message: 'Authentication required. Please log in to continue.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, getJwtSecret());

    // Fetch active user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        message: 'The user account associated with this token no longer exists.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        message: 'This user account has been deactivated. Please contact an Owner.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid authentication token.' });
  }
};

/**
 * RBAC Permission Middleware Factory:
 * Enforces that req.user holds the required granular permission.
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        message: `Forbidden: role '${req.user.role}' lacks permission '${permission}'`
      });
    }

    next();
  };
};

/**
 * Site Access Middleware:
 * Restricts non-Owner users to only their assigned sites.
 */
const requireSiteAccess = (siteExtractor) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Owner has unrestricted access across all sites
    if (req.user.role === 'Owner') {
      return next();
    }

    // Extract site from request
    let targetSite = null;
    if (typeof siteExtractor === 'function') {
      targetSite = siteExtractor(req);
    } else {
      targetSite = req.body?.site || req.query?.site || req.params?.site;
    }

    // If no site is targeted, proceed (legacy items or general queries)
    if (!targetSite) {
      return next();
    }

    const assignedSites = req.user.assignedSites || [];
    const hasSite = assignedSites.some(
      (s) => s.trim().toLowerCase() === targetSite.trim().toLowerCase()
    );

    if (!hasSite) {
      return res.status(403).json({
        message: `Forbidden: You do not have permission to access site '${targetSite}'`
      });
    }

    next();
  };
};

/**
 * CSRF Protection Middleware:
 * For state-changing operations authenticated via cookies, validates that
 * x-csrf-token header matches the xsrf-token cookie.
 */
const verifyCsrf = (req, res, next) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // If request uses Authorization Bearer header, CSRF is not required (API client / automated tests)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  // If request uses cookie authentication, verify CSRF header against cookie
  if (req.cookies && req.cookies.token) {
    const csrfHeader = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    const csrfCookie = req.cookies['xsrf-token'];

    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return res.status(403).json({
        message: 'Invalid or missing CSRF token. Request rejected.'
      });
    }
  }

  next();
};

module.exports = {
  authenticate,
  requirePermission,
  requireSiteAccess,
  verifyCsrf,
  getJwtSecret
};
