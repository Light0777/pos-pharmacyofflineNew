import db from '../database/connection';
import type { User } from '../types/index';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export class UserModel {
  // ==================== Basic CRUD Operations ====================

  // Create user
  static create(user: Omit<User, 'created_at' | 'updated_at'>): User {
    const uuid = user.user_uuid || uuidv4();

    const stmt = db.prepare(`
    INSERT INTO users (user_uuid, name, email, password, role, security_question, security_answer)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
      uuid,
      user.name,
      user.email,
      user.password,
      user.role,
      user.security_question || null,
      user.security_answer || null
    );


    return this.findByEmail(user.email)!;
  }

  // Find user by email (returns full user with password)
  static findByEmail(email: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  // Find user by UUID (returns full user with password)
  static findById(uuid: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE user_uuid = ?');
    return stmt.get(uuid) as User | undefined;
  }

  // Get all users (safe - without passwords or security_answer)
  static findAll(): Omit<User, 'password' | 'security_answer'>[] {
    const stmt = db.prepare(
      'SELECT user_uuid, name, email, role, security_question, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return stmt.all() as Omit<User, 'password' | 'security_answer'>[];
  }

  // Update user
  static update(uuid: string, updates: Partial<User>): User | undefined {
    const allowedFields = ['name', 'email', 'password', 'role'];
    const updateFields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key === 'password') {
          updateFields.push(`${key} = ?`);
          values.push(bcrypt.hashSync(String(value), 10));
        } else {
          updateFields.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (updateFields.length === 0) return this.findById(uuid);

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(uuid);

    const stmt = db.prepare(`
      UPDATE users SET ${updateFields.join(', ')} WHERE user_uuid = ?
    `);

    stmt.run(...values);
    return this.findById(uuid);
  }

  // Delete user
  static delete(uuid: string): boolean {
    const stmt = db.prepare('DELETE FROM users WHERE user_uuid = ?');
    const result = stmt.run(uuid);
    return result.changes > 0;
  }

  // Convert user to safe user (remove password and security_answer)
  static toSafeUser(user: User): Omit<User, 'password' | 'security_answer'> {
    const { password, security_answer, ...safeUser } = user;
    return safeUser;
  }

  // ==================== Staff Management ====================

  // Create staff user (restricted to manager/cashier roles)
  static createStaff(data: {
    name: string;
    email: string;
    password: string;
    role: 'manager' | 'cashier';
    security_question?: string;
    security_answer?: string;
  }): User {
    // Validate role
    if (!['manager', 'cashier'].includes(data.role)) {
      throw new Error('Invalid role. Must be manager or cashier');
    }

    // Check if email already exists
    const existingUser = this.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const uuid = uuidv4();
    const hashedPassword = bcrypt.hashSync(data.password, 10);
    const hashedAnswer = data.security_answer
      ? bcrypt.hashSync(data.security_answer.toLowerCase().trim(), 10)
      : null;

    const stmt = db.prepare(`
      INSERT INTO users (user_uuid, name, email, password, role, security_question, security_answer)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(uuid, data.name, data.email, hashedPassword, data.role, data.security_question || null, hashedAnswer);

    return this.findById(uuid)!;
  }

  // Get all staff members (including admin, managers, and cashiers) - returns full User objects
  static getAllStaff(): User[] {
    return db.prepare(`
      SELECT * FROM users 
      WHERE role IN ('admin', 'manager', 'cashier')
      ORDER BY created_at DESC
    `).all() as User[];
  }

  // Update staff user (with role restrictions) - returns full User object
  static updateStaff(uuid: string, data: {
    name?: string;
    email?: string;
    password?: string;
    role?: 'manager' | 'cashier';
    security_question?: string;
    security_answer?: string;
  }): User | undefined {
    const user = this.findById(uuid);
    if (!user) return undefined;

    // Validate role if provided
    if (data.role && !['manager', 'cashier'].includes(data.role)) {
      throw new Error('Invalid role. Must be manager or cashier');
    }

    // Check email uniqueness if changing
    if (data.email && data.email !== user.email) {
      const existingUser = this.findByEmail(data.email);
      if (existingUser && existingUser.user_uuid !== uuid) {
        throw new Error('Email already exists');
      }
    }

    const updateFields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }
    if (data.email !== undefined) {
      updateFields.push('email = ?');
      values.push(data.email);
    }
    if (data.password !== undefined && data.password.length > 0) {
      const hashedPassword = bcrypt.hashSync(data.password, 10);
      updateFields.push('password = ?');
      values.push(hashedPassword);
    }
    if (data.role !== undefined) {
      updateFields.push('role = ?');
      values.push(data.role);
    }
    if (data.security_question !== undefined) {
      updateFields.push('security_question = ?');
      values.push(data.security_question);
    }
    if (data.security_answer !== undefined && data.security_answer.length > 0) {
      const hashedAnswer = bcrypt.hashSync(data.security_answer.toLowerCase().trim(), 10);
      updateFields.push('security_answer = ?');
      values.push(hashedAnswer);
    }

    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(uuid);

      db.prepare(`
        UPDATE users SET ${updateFields.join(', ')} WHERE user_uuid = ?
      `).run(...values);
    }

    return this.findById(uuid);
  }

  // Delete staff user
  static deleteStaff(uuid: string): boolean {
    const user = this.findById(uuid);
    if (!user) return false;

    return this.delete(uuid);
  }

  // Get staff members by specific role - returns full User objects
  static getStaffByRole(role: 'admin' | 'manager' | 'cashier'): User[] {
    return db.prepare(`
      SELECT * FROM users 
      WHERE role = ?
      ORDER BY name ASC
    `).all(role) as User[];
  }

  // Count staff by role
  static countStaffByRole(): Array<{ role: string; count: number }> {
    return db.prepare(`
      SELECT role, COUNT(*) as count
      FROM users 
      WHERE role IN ('admin', 'manager', 'cashier')
      GROUP BY role
    `).all() as Array<{ role: string; count: number }>;
  }

  // Check if user is admin
  static isAdmin(uuid: string): boolean {
    const user = this.findById(uuid);
    return user?.role === 'admin';
  }

  // ==================== Utility Methods ====================

  // Check if user exists
  static exists(uuid: string): boolean {
    const result = db.prepare('SELECT 1 FROM users WHERE user_uuid = ?').get(uuid);
    return !!result;
  }

  // Count total users
  static count(): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    return result.count;
  }

  // Get users by role - returns full User objects for internal use
  static getByRole(role: string): User[] {
    return db.prepare(`
      SELECT * FROM users 
      WHERE role = ?
      ORDER BY created_at DESC
    `).all(role) as User[];
  }

  // Verify password
  static verifyPassword(plainPassword: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  // Change password
  static changePassword(uuid: string, newPassword: string): boolean {
    const user = this.findById(uuid);
    if (!user) return false;

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    const result = db.prepare(`
      UPDATE users 
      SET password = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_uuid = ?
    `).run(hashedPassword, uuid);

    return result.changes > 0;
  }

  // Search users by name or email - returns safe users without passwords
  static search(query: string): Omit<User, 'password'>[] {
    return db.prepare(`
      SELECT user_uuid, name, email, role, created_at, updated_at
      FROM users 
      WHERE name LIKE ? OR email LIKE ?
      ORDER BY name ASC
      LIMIT 20
    `).all(`%${query}%`, `%${query}%`) as Omit<User, 'password'>[];
  }

  // ==================== Security Question Methods ====================

  // Get security question for a user by email
  static getSecurityQuestion(email: string): string | null {
    const user = db.prepare(`
      SELECT security_question FROM users WHERE email = ?
    `).get(email) as { security_question: string } | undefined;
    return user?.security_question || null;
  }

  // Verify security answer for a user
  static verifySecurityAnswer(email: string, answer: string): boolean {
    const user = db.prepare(`
      SELECT security_answer FROM users WHERE email = ?
    `).get(email) as { security_answer: string } | undefined;
    if (!user?.security_answer) return false;
    return bcrypt.compareSync(answer.toLowerCase().trim(), user.security_answer);
  }

  // Set security question for a user
  static setSecurityQuestion(uuid: string, question: string, answer: string): boolean {
    const hashedAnswer = bcrypt.hashSync(answer.toLowerCase().trim(), 10);
    const result = db.prepare(`
      UPDATE users SET security_question = ?, security_answer = ?, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = ?
    `).run(question, hashedAnswer, uuid);
    return result.changes > 0;
  }

  // Reset password by email
  static resetPassword(email: string, newPassword: string): boolean {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const result = db.prepare(`
      UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?
    `).run(hashedPassword, email);
    return result.changes > 0;
  }
}
