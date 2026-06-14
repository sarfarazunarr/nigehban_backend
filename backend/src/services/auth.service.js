const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { redisClient } = require('../config/redis');

// Token Signers
const signAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET || 'nigehbaan_access_secret_129847129847',
    { expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m' }
  );
};

const signRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || 'nigehbaan_refresh_secret_129847129847',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

/**
 * Registers a new user in the system
 */
const registerUser = async (userData) => {
  const { phone, cnic, email, password, role } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ phone }, { cnic }, { email }]
  });

  if (existingUser) {
    if (existingUser.phone === phone) throw new Error('Phone number is already registered.');
    if (existingUser.cnic === cnic) throw new Error('CNIC is already registered.');
    if (existingUser.email === email) throw new Error('Email is already registered.');
  }

  const user = await User.create({
    phone,
    cnic,
    email,
    password,
    role: role || 'User'
  });

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // Store refresh token in Redis (Key format: refresh_token:<userId>:<token>)
  if (redisClient.status === 'ready') {
    await redisClient.set(
      `refresh_token:${user._id}:${refreshToken}`,
      'active',
      'EX',
      7 * 24 * 60 * 60 // 7 days in seconds
    );
  }

  // Remove password from output
  user.password = undefined;

  return { user, accessToken, refreshToken };
};

/**
 * Logins a user and issues tokens
 */
const loginUser = async (phoneOrEmail, password) => {
  // Find user by phone or email
  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  }).select('+password');

  if (!user) {
    throw new Error('Invalid credentials.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials.');
  }

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // Store refresh token in Redis
  if (redisClient.status === 'ready') {
    await redisClient.set(
      `refresh_token:${user._id}:${refreshToken}`,
      'active',
      'EX',
      7 * 24 * 60 * 60
    );
  }

  user.password = undefined;

  return { user, accessToken, refreshToken };
};

/**
 * Refreshes an access token using a valid refresh token
 */
const refreshSession = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'nigehbaan_refresh_secret_129847129847'
    );
  } catch (error) {
    throw new Error('Invalid refresh token.');
  }

  // Check Redis to make sure token is not revoked/logged out
  if (redisClient.status === 'ready') {
    const status = await redisClient.get(`refresh_token:${decoded.id}:${refreshToken}`);
    if (!status) {
      throw new Error('Refresh token is expired or revoked.');
    }
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new Error('User no longer exists.');
  }

  const newAccessToken = signAccessToken(user._id);
  return { accessToken: newAccessToken };
};

/**
 * Logouts a user, revoking the refresh token in Redis
 */
const logoutSession = async (userId, refreshToken) => {
  if (redisClient.status === 'ready') {
    await redisClient.del(`refresh_token:${userId}:${refreshToken}`);
  }
  return true;
};

/**
 * Initiates the forgot password flow, returns reset token & expires info
 */
const generatePasswordResetToken = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('No user registered with this email.');
  }

  // Generate a random hex token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set user fields
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiration to 10 minutes
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  return resetToken;
};

/**
 * Resets user's password using the token
 */
const resetUserPassword = async (resetToken, newPassword) => {
  // Hash token
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    throw new Error('Invalid or expired reset token.');
  }

  // Set new password (the model hook will hash this)
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  // Revoke all existing refresh tokens for security
  if (redisClient.status === 'ready') {
    const keys = await redisClient.keys(`refresh_token:${user._id}:*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  }

  return true;
};

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutSession,
  generatePasswordResetToken,
  resetUserPassword
};
