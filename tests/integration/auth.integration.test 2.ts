// @vitest-environment node

/**
 * Auth Integration Tests
 * Tests real JWT authentication flows using SQLite test database.
 * Does NOT mock authenticateToken — tests the real auth stack.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Strong passwords that meet validation requirements (uppercase, lowercase, number, special char)
const STRONG_PASSWORD = 'Test@Secure2024!';

describe('Auth routes', () => {
  let tempDir = '';
  let baseUrl = '';
  let server: import('http').Server;
  let pool: { end?: () => Promise<void> | void };

  const request = async (pathname: string, init: RequestInit = {}) => {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: { 'Content-Type': 'application/json', ...((init.headers as object) ?? {}) },
      ...init
    });
    const text = await response.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { response, data };
  };

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plumbpro-auth-'));
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = path.join(tempDir, 'auth-test.db');
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'auth-integration-test-secret-32-chars-minimum';
    process.env.ENABLE_REGISTRATION = 'true';

    vi.resetModules();

    const { createServer } = await import('../../server/src/server.js');
    const created = createServer({ nodeEnv: 'test' });
    pool = created.pool;
    server = created.app.listen(0);
    await new Promise<void>(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close(err => (err ? reject(err) : resolve()))
    );
    await pool?.end?.();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('registers a new user successfully', async () => {
    const { response, data } = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@plumbpro.com',
        password: STRONG_PASSWORD,
        fullName: 'Test Admin',
        role: 'admin'
      })
    });

    expect(response.status).toBe(201);
    expect((data as any).token).toBeTruthy();
    expect((data as any).user.email).toBe('test@plumbpro.com');
    expect((data as any).user.password).toBeUndefined(); // password not exposed
  });

  it('rejects duplicate email registration', async () => {
    // Register once
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'dup@plumbpro.com',
        password: STRONG_PASSWORD,
        fullName: 'Dup User',
        role: 'user'
      })
    });

    // Try to register again with same email
    const { response } = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'dup@plumbpro.com',
        password: STRONG_PASSWORD,
        fullName: 'Dup User',
        role: 'user'
      })
    });

    expect(response.status).toBe(409);
  });

  it('rejects registration with a common password', async () => {
    const { response, data } = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'weakpass@plumbpro.com',
        password: 'Password1!', // in COMMON_PASSWORDS list
        fullName: 'Weak Pass',
        role: 'user'
      })
    });

    expect(response.status).toBe(400);
    expect((data as any).code).toBe('WEAK_PASSWORD');
  });

  it('logs in with correct credentials and returns a JWT', async () => {
    // Register first
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'login@plumbpro.com',
        password: STRONG_PASSWORD,
        fullName: 'Login Test',
        role: 'user'
      })
    });

    // Now login
    const { response, data } = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'login@plumbpro.com', password: STRONG_PASSWORD })
    });

    expect(response.status).toBe(200);
    expect((data as any).token).toBeTruthy();
  });

  it('rejects login with wrong password', async () => {
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'wrongpass@plumbpro.com',
        password: STRONG_PASSWORD,
        fullName: 'Wrong Pass',
        role: 'user'
      })
    });

    const { response } = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'wrongpass@plumbpro.com', password: 'WrongP@ss123!' })
    });

    expect(response.status).toBe(401);
  });

  it('rejects requests with an invalid JWT token', async () => {
    const { response } = await request('/api/auth/me', {
      headers: { Authorization: 'Bearer invalid.jwt.token' }
    });

    expect(response.status).toBe(403);
  });

  it('validates JWT and allows protected routes with valid token', async () => {
    // Register and get a token
    const { data: regData } = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'jwt-test@plumbpro.com',
        password: STRONG_PASSWORD,
        fullName: 'JWT Test',
        role: 'user'
      })
    });

    const token = (regData as any).token;

    const { response } = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    expect(response.status).toBe(200);
  });

  it('allows logout and rejects the revoked token', async () => {
    // Register and get a token
    const { data: regData } = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'logout-test@plumbpro.com',
        password: STRONG_PASSWORD,
        fullName: 'Logout Test',
        role: 'user'
      })
    });

    const token = (regData as any).token;
    expect(token).toBeTruthy();

    // Logout
    const { response: logoutResponse } = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(logoutResponse.status).toBe(200);

    // Same token should now be rejected
    const { response: afterLogout } = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(afterLogout.status).toBe(401);
  });
});
