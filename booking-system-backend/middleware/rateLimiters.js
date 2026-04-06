const rateLimit = require('express-rate-limit');

const defaultLimiterOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

const apiLimiter = rateLimit({
  ...defaultLimiterOptions,
  windowMs: 15 * 60 * 1000,
  max: 400,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLoginLimiter = rateLimit({
  ...defaultLimiterOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please wait and try again.' },
});

const authRegisterLimiter = rateLimit({
  ...defaultLimiterOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many sign-up attempts. Please try again later.' },
});

const authRecoveryLimiter = rateLimit({
  ...defaultLimiterOptions,
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: 'Too many authentication requests. Please wait and try again.' },
});

module.exports = {
  apiLimiter,
  authLoginLimiter,
  authRegisterLimiter,
  authRecoveryLimiter,
};