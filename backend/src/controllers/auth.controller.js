const { z } = require('zod');
const authService = require('../services/auth.service');
const { sendResetEmail } = require('../services/mail.service');

// Validation Schemas
const registerSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15),
  cnic: z.string().min(13, 'CNIC must be 13 digits').max(15),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['User', 'Guardian', 'CorporateAdmin', 'SuperAdmin']).optional(),
  name: z.string().optional(),
  address: z.string().optional()
});

const loginSchema = z.object({
  phoneOrEmail: z.string().min(1, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters')
});

/**
 * Register user
 */
const register = async (req, res, next) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.registerUser(validatedData);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.loginUser(
      validatedData.phoneOrEmail,
      validatedData.password
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user
    });
  } catch (error) {
    // If invalid credentials, make sure to send 401
    if (error.message === 'Invalid credentials.') {
      return res.status(401).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * Refresh access token
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required.' });
    }

    const { accessToken } = await authService.refreshSession(refreshToken);
    res.status(200).json({
      success: true,
      accessToken
    });
  } catch (error) {
    return res.status(401).json({ success: false, error: error.message });
  }
};

/**
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required for logout.' });
    }

    await authService.logoutSession(req.user._id, refreshToken);
    res.status(200).json({
      success: true,
      message: 'Logout successful. Token revoked.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    const resetToken = await authService.generatePasswordResetToken(validatedData.email);

    // Create reset URL
    const protocol = req.protocol;
    const host = req.get('host');
    const resetUrl = `${protocol}://${host}/api/auth/reset-password/${resetToken}`;

    // Send email
    await sendResetEmail(validatedData.email, resetUrl);

    res.status(200).json({
      success: true,
      message: 'Reset link sent to email address.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const validatedData = resetPasswordSchema.parse(req.body);

    await authService.resetUserPassword(token, validatedData.password);

    res.status(200).json({
      success: true,
      message: 'Password reset successful. All other sessions have been revoked.'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword
};
