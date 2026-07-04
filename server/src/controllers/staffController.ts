import type { Request, Response } from 'express';
import { UserModel } from '../models/User';
import type { AuthRequest } from '../middleware/auth';

export class StaffController {
  // Create new staff member
  static store = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, email, password, role } = req.body;

      // Validation
      if (!name || !email || !password || !role) {
        res.status(400).json({ 
          error: 'Name, email, password, and role are required' 
        });
        return;
      }

      // Validate role
      if (!['manager', 'cashier'].includes(role)) {
        res.status(400).json({ 
          error: 'Role must be manager or cashier' 
        });
        return;
      }

      // Validate password length
      if (password.length < 6) {
        res.status(400).json({ 
          error: 'Password must be at least 6 characters' 
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ 
          error: 'Invalid email format' 
        });
        return;
      }

      // Check if email already exists
      const existingUser = UserModel.findByEmail(email);
      if (existingUser) {
        res.status(400).json({ 
          error: 'Email already exists' 
        });
        return;
      }

      // Create staff user
      const user = UserModel.createStaff({
        name: String(name),
        email: String(email),
        password: String(password),
        role: role as 'manager' | 'cashier',
        security_question: req.body.security_question ? String(req.body.security_question) : undefined,
        security_answer: req.body.security_answer ? String(req.body.security_answer) : undefined
      });

      // Return user without password
      const safeUser = UserModel.toSafeUser(user);

      res.status(201).json(safeUser);
    } catch (error: any) {
      console.error('Create staff error:', error);
      
      if (error.message === 'Invalid role. Must be manager or cashier') {
        res.status(400).json({ error: error.message });
        return;
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // List all staff members
  static index = (req: AuthRequest, res: Response): void => {
    try {
      const users = UserModel.getAllStaff();
      
      // Return safe users with has_password flag
      const safeUsers = users.map(user => ({
        ...UserModel.toSafeUser(user),
        has_password: !!user.password
      }));

      res.json(safeUsers);
    } catch (error) {
      console.error('List staff error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Update staff member
  static update = (req: AuthRequest, res: Response): void => {
    try {
      const userUuid = String(req.params.user_uuid);
      const { name, email, password, role } = req.body;

      // Check if user exists
      const existingUser = UserModel.findById(userUuid);
      if (!existingUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check if trying to modify owner
      if (existingUser.role === 'owner') {
        res.status(403).json({ error: 'Cannot modify owner account through staff management' });
        return;
      }

      // Validate required fields for update
      if (!name || !email || !role) {
        res.status(400).json({ 
          error: 'Name, email, and role are required' 
        });
        return;
      }

      // Validate role
      if (!['manager', 'cashier'].includes(role)) {
        res.status(400).json({ 
          error: 'Role must be manager or cashier' 
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ 
          error: 'Invalid email format' 
        });
        return;
      }

      // Check email uniqueness (excluding current user)
      if (email !== existingUser.email) {
        const emailExists = UserModel.findByEmail(email);
        if (emailExists && emailExists.user_uuid !== userUuid) {
          res.status(400).json({ 
            error: 'Email already exists' 
          });
          return;
        }
      }

      // Validate password if provided
      if (password && password.length < 6) {
        res.status(400).json({ 
          error: 'Password must be at least 6 characters' 
        });
        return;
      }

      // Update staff user
      const updatedUser = UserModel.updateStaff(userUuid, {
        name: String(name),
        email: String(email),
        password: password ? String(password) : undefined,
        role: role as 'manager' | 'cashier',
        security_question: req.body.security_question ? String(req.body.security_question) : undefined,
        security_answer: req.body.security_answer ? String(req.body.security_answer) : undefined,
      });

      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Return user without password
      const safeUser = UserModel.toSafeUser(updatedUser);

      res.json(safeUser);
    } catch (error: any) {
      console.error('Update staff error:', error);
      
      if (error.message === 'Cannot modify owner account through staff management') {
        res.status(403).json({ error: error.message });
        return;
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Delete staff member
  static destroy = (req: AuthRequest, res: Response): void => {
    try {
      const userUuid = String(req.params.user_uuid);

      // Check if user exists
      const existingUser = UserModel.findById(userUuid);
      if (!existingUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Prevent deleting owner
      if (existingUser.role === 'owner') {
        res.status(403).json({ error: 'Cannot delete owner account' });
        return;
      }

      // Prevent self-deletion
      if (req.user && req.user.user_uuid === userUuid) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }

      const deleted = UserModel.deleteStaff(userUuid);

      if (!deleted) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ message: 'Staff deleted' });
    } catch (error: any) {
      console.error('Delete staff error:', error);
      
      if (error.message === 'Cannot delete owner account') {
        res.status(403).json({ error: error.message });
        return;
      }
      
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Get staff members by role
  static byRole = (req: AuthRequest, res: Response): void => {
    try {
      const role = String(req.params.role);
      
      if (!['manager', 'cashier'].includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
      }

      const users = UserModel.getStaffByRole(role as 'manager' | 'cashier');
      const safeUsers = users.map(user => UserModel.toSafeUser(user));

      res.json(safeUsers);
    } catch (error) {
      console.error('Get staff by role error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Get staff summary
  static summary = (req: AuthRequest, res: Response): void => {
    try {
      const staffCount = UserModel.countStaffByRole();
      
      res.json({
        staff_by_role: staffCount,
        total_staff: staffCount.reduce((sum: number, item: any) => sum + item.count, 0)
      });
    } catch (error) {
      console.error('Staff summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
