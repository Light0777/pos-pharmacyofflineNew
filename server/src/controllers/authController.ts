import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/User';
import db from '../database/connection';
import type { AuthRequest } from '../middleware/auth';

export class AuthController {
  // Register new user and create settings
  static register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { shop_name, name, email, password, security_question, security_answer } = req.body;

      // Validate input
      if (!shop_name || !name || !email || !password) {
        res.status(400).json({ error: 'All fields are required' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      // Check if user already exists
      const existingUser = UserModel.findByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: 'Email already registered' });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const hashedAnswer = security_answer
        ? await bcrypt.hash(security_answer.toLowerCase().trim(), 10)
        : undefined;

      // Create user
      const user = UserModel.create({
        user_uuid: uuidv4(),
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        security_question: security_question || undefined,
        security_answer: hashedAnswer
      });

      // Create settings for the shop
      const settingsStmt = db.prepare(`
        INSERT INTO settings (shop_name)
        VALUES (?)
      `);
      settingsStmt.run(shop_name);

      // Get created settings
      const settings = db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();

      // Generate JWT token
      const token = jwt.sign(
        { user_uuid: user.user_uuid, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '10y' }
      );

      res.status(201).json({
        user: UserModel.toSafeUser(user),
        shop: settings,
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Login user
  static login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Find user
      const user = UserModel.findByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        { user_uuid: user.user_uuid, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '10y' }
      );

      // Get shop settings
      const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();

      res.json({
        user: UserModel.toSafeUser(user),
        shop: settings,
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Get current user profile
  static me = (req: AuthRequest, res: Response): void => {
    try {
      const settings = db.prepare('SELECT * FROM settings LIMIT 1').get();
      
      res.json({
        user: req.user,
        shop: settings
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Forgot password - Step 1: Get security question
  static forgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      const user = UserModel.findByEmail(email);
      if (!user) {
        res.status(404).json({ error: 'No account found with this email' });
        return;
      }

      if (!user.security_question) {
        res.status(400).json({ error: 'No security question set for this account. Contact your administrator.' });
        return;
      }

      res.json({ security_question: user.security_question });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Forgot password - Step 2: Verify security answer
  static verifyAnswer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, answer } = req.body;

      if (!email || !answer) {
        res.status(400).json({ error: 'Email and answer are required' });
        return;
      }

      const user = UserModel.findByEmail(email);
      if (!user) {
        res.status(404).json({ error: 'No account found with this email' });
        return;
      }

      const isValid = await bcrypt.compare(answer.toLowerCase().trim(), user.security_answer || '');
      if (!isValid) {
        res.status(401).json({ error: 'Incorrect answer' });
        return;
      }

      // Generate short-lived token for password reset
      const resetToken = jwt.sign(
        { email: user.email, purpose: 'password-reset' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '5m' }
      );

      res.json({ token: resetToken });
    } catch (error) {
      console.error('Verify answer error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Forgot password - Step 3: Reset password
  static resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({ error: 'Token and new password are required' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }

      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      } catch {
        res.status(401).json({ error: 'Invalid or expired token. Please start over.' });
        return;
      }

      if (decoded.purpose !== 'password-reset') {
        res.status(401).json({ error: 'Invalid token purpose' });
        return;
      }

      const success = UserModel.resetPassword(decoded.email, newPassword);
      if (!success) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Set security question (authenticated user)
  static setSecurityQuestion = (req: AuthRequest, res: Response): void => {
    try {
      const { security_question, security_answer } = req.body;

      if (!security_question || !security_answer) {
        res.status(400).json({ error: 'Security question and answer are required' });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const success = UserModel.setSecurityQuestion(req.user.user_uuid, security_question, security_answer);
      if (!success) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: 'Security question updated successfully' });
    } catch (error) {
      console.error('Set security question error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Logout (optional - for token blacklisting if needed)
  static logout = (req: AuthRequest, res: Response): void => {
    // In a simple JWT setup, logout is handled client-side by removing the token
    // For enhanced security, you could implement a token blacklist
    res.json({ message: 'Logged out successfully' });
  };
}
