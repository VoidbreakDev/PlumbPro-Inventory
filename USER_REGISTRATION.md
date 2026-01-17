# User Registration Guide

## Overview

User registration (signup) is now fully enabled in PlumbPro Inventory. New users can create their own accounts directly from the login screen.

---

## How to Register a New Account

### Step 1: Access the Registration Form

1. Open the PlumbPro app in your browser
2. On the login screen, click **"Don't have an account? Sign up"**
3. The form will switch to registration mode

### Step 2: Fill in Registration Details

**Required Fields:**
- **Full Name** - Your full name (e.g., "John Smith")
- **Email Address** - Valid email address (must be unique)
- **Password** - At least 6 characters long

**Optional Fields:**
- **Company Name** - Your company name (e.g., "Smith Plumbing Co.")

### Step 3: Create Account

1. Click the **"Create Account"** button
2. The system will:
   - Validate your information
   - Hash your password securely (bcrypt)
   - Create your user account in the database
   - Generate a JWT authentication token
   - Automatically log you in
   - Redirect to the main dashboard

### Step 4: Start Using the App

After registration, you'll have:
- A fresh, empty account
- Full access to all features
- Your own isolated data space
- Multi-device sync capability

---

## Registration Validation

### Email Validation

**Requirements:**
- Must be a valid email format
- Must be unique (not already registered)
- Case-insensitive (duplicate check)

**Error Messages:**
- ❌ "Email already registered" - This email is already in use
- ❌ "Invalid email" - Email format is incorrect

### Password Validation

**Requirements:**
- Minimum 6 characters
- No maximum length
- Can include any characters

**Security:**
- Passwords are hashed with bcrypt (10 rounds)
- Never stored or transmitted in plain text
- Cannot be recovered (only reset)

**Error Message:**
- ❌ "Password must be at least 6 characters"

### Full Name Validation

**Requirements:**
- Cannot be empty
- Whitespace is trimmed

**Error Message:**
- ❌ "Full name is required"

### Company Name Validation

**Optional field** - No validation required

---

## What Happens After Registration

### 1. Account Creation
```sql
INSERT INTO users (
  email,
  password_hash,
  full_name,
  company_name,
  role,
  is_active
) VALUES (
  'user@example.com',
  '$2a$10$...', -- bcrypt hash
  'John Smith',
  'Smith Plumbing Co.',
  'user',
  true
);
```

### 2. JWT Token Generation
```javascript
{
  userId: "uuid-here",
  email: "user@example.com",
  role: "user"
}
// Signed with JWT_SECRET
// Expires in 7 days
```

### 3. Auto-Login
- Token stored in `localStorage.authToken`
- User data stored in `localStorage.user`
- App state updated to authenticated
- Redirected to dashboard

### 4. Empty Data Space
New users start with:
- 0 contacts
- 0 inventory items
- 0 jobs
- 0 templates
- Fresh database records

---

## User Roles

### Default Role: `user`

All new registrations receive the **"user"** role by default.

**User Permissions:**
- ✅ Create, read, update, delete their own data
- ✅ Access all app features
- ✅ Manage inventory, contacts, jobs
- ✅ Use AI features (if API keys configured)
- ✅ Sync across devices

### Admin Role: `admin`

The demo account and manually created accounts can have **"admin"** role.

**Admin Permissions:**
- All user permissions
- Potential for future admin-only features
- Currently functionally equivalent to "user"

**Creating Admin Accounts:**

Admins must be created manually via database script:

```bash
cd server
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function createAdmin() {
  const passwordHash = await bcrypt.hash('your-password', 10);

  const result = await pool.query(\`
    INSERT INTO users (email, password_hash, full_name, company_name, role, is_active)
    VALUES (\$1, \$2, \$3, \$4, 'admin', true)
    RETURNING id, email, full_name, role
  \`, ['admin@example.com', passwordHash, 'Admin User', 'Company Name']);

  console.log('Admin created:', result.rows[0]);
  await pool.end();
}

createAdmin();
"
```

---

## Data Isolation

### How It Works

Each user's data is completely isolated using the `user_id` column:

**Database Level:**
```sql
-- Every table has user_id column
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255),
  ...
);

-- Foreign key ensures data integrity
CONSTRAINT contacts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE
```

**API Level:**
```javascript
// All queries filter by authenticated user
SELECT * FROM contacts
WHERE user_id = $1  -- req.user.userId from JWT
ORDER BY name ASC;
```

**Benefits:**
- ✅ Users can only see their own data
- ✅ Cannot access other users' information
- ✅ Accidental data leaks prevented
- ✅ CASCADE deletes protect data integrity

---

## Multi-Device Usage

### Same Account, Multiple Devices

Users can log in from multiple devices simultaneously:

**How to Use:**
1. Register account on Device 1
2. Create some data (contacts, inventory)
3. Log in with same email/password on Device 2
4. Data automatically syncs from database
5. Changes on either device sync instantly

**Example Flow:**

**Desktop:**
1. Register: `john@plumbpro.com` / `password123`
2. Add contact: "ABC Supplies"

**Mobile:**
1. Login: `john@plumbpro.com` / `password123`
2. View contacts → See "ABC Supplies"
3. Add contact: "XYZ Tools"

**Desktop:**
1. Refresh page
2. View contacts → See both "ABC Supplies" and "XYZ Tools"

---

## Registration API Reference

### Endpoint

```
POST /api/auth/register
```

### Request Body

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "fullName": "John Smith",
  "companyName": "Smith Plumbing Co."  // optional
}
```

### Success Response

**Status:** `201 Created`

```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "fullName": "John Smith",
    "companyName": "Smith Plumbing Co.",
    "role": "user"
  }
}
```

### Error Responses

**Email Already Registered:**

**Status:** `409 Conflict`
```json
{
  "error": "Email already registered"
}
```

**Validation Error:**

**Status:** `400 Bad Request`
```json
{
  "errors": [
    {
      "msg": "Invalid email",
      "param": "email"
    }
  ]
}
```

**Server Error:**

**Status:** `500 Internal Server Error`
```json
{
  "error": "Registration failed"
}
```

---

## Testing Registration

### Test Case 1: Successful Registration

1. **Action:** Click "Don't have an account? Sign up"
2. **Fill in:**
   - Full Name: "Test User"
   - Company Name: "Test Company"
   - Email: "testuser@example.com"
   - Password: "password123"
3. **Submit:** Click "Create Account"
4. **Expected:** Redirected to dashboard, logged in automatically

### Test Case 2: Duplicate Email

1. **Action:** Try to register with existing email
2. **Expected:** Error message "Email already registered"

### Test Case 3: Password Too Short

1. **Action:** Try password "12345" (5 characters)
2. **Expected:** Error message "Password must be at least 6 characters"

### Test Case 4: Missing Full Name

1. **Action:** Leave full name empty
2. **Expected:** Error message "Full name is required"

### Test Case 5: Switch Between Login and Register

1. **Action:** Click "Don't have an account? Sign up"
2. **Expected:** Form clears, shows registration fields
3. **Action:** Click "Already have an account? Sign in"
4. **Expected:** Form shows demo credentials again

---

## Security Considerations

### Password Security

✅ **Strong Hashing:**
- bcrypt algorithm
- 10 salt rounds
- Resistant to rainbow tables

✅ **No Plain Text Storage:**
- Passwords never stored in plain text
- Cannot be retrieved, only reset

✅ **Secure Transmission:**
- Use HTTPS in production
- Password sent once during registration
- Never logged or cached

### Token Security

✅ **JWT Best Practices:**
- Signed with strong secret (64 bytes)
- 7-day expiration
- Cannot be forged without secret

✅ **Token Storage:**
- Stored in localStorage (client-side only)
- Sent in Authorization header
- Cleared on logout

### Email Validation

✅ **Duplicate Prevention:**
- UNIQUE constraint on email column
- Case-insensitive check
- 409 error if already exists

✅ **Format Validation:**
- Express-validator checks format
- Normalizes email (lowercase)
- Prevents invalid emails

---

## Troubleshooting

### Issue: "Email already registered"

**Cause:** Email is already in use

**Solution:**
1. Use different email address
2. Or login with existing account
3. Check for typos in email

### Issue: "Registration failed" (500 error)

**Causes:**
- Database connection issue
- Server error
- Network problem

**Solutions:**
1. Check backend server is running: `lsof -i:5001`
2. Check database is accessible
3. Check backend logs for errors
4. Ensure CORS is configured correctly

### Issue: Registration succeeds but can't see data on another device

**Cause:** Not logged in with same account on second device

**Solution:**
1. Ensure using exact same email on both devices
2. Check you're logging in, not creating new account
3. Verify data exists by checking first device

### Issue: Can't access API from mobile

**Cause:** API URL pointing to localhost

**Solution:**
1. Check `.env` has your laptop's IP: `VITE_API_URL=http://192.168.1.115:5001/api`
2. Ensure mobile and laptop on same WiFi
3. Restart frontend dev server after changing .env

---

## Production Deployment

### Before Going to Production:

**1. Change JWT Secret:**
```bash
# Generate new secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Update server/.env
JWT_SECRET=<new-secret-here>
```

**2. Enable HTTPS:**
- Get SSL/TLS certificate
- Configure reverse proxy (nginx)
- Update API URL to use https://

**3. Update CORS:**
```javascript
// In production, restrict CORS to your domain
app.use(cors({
  origin: 'https://yourapp.com',
  credentials: true
}));
```

**4. Add Rate Limiting:**
```javascript
// Prevent brute force attacks
import rateLimit from 'express-rate-limit';

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many registration attempts, please try again later'
});

app.use('/api/auth/register', registerLimiter);
```

**5. Email Verification (Optional):**
- Send verification email after registration
- Prevent account access until verified
- Protects against fake registrations

**6. Password Requirements:**
- Consider stronger requirements:
  - Minimum 8 characters
  - Require uppercase, lowercase, number
  - Require special character

---

## Summary

✅ **Registration is fully enabled**
- Users can self-register from login screen
- No manual account creation needed
- Automatic login after registration

✅ **Secure by default**
- Password hashing with bcrypt
- JWT authentication
- Data isolation per user

✅ **Ready to use**
- Works on desktop and mobile
- Multi-device sync supported
- No configuration needed

**Start registering new users today!** 🎉
