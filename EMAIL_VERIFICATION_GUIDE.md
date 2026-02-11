# Email Verification Setup Guide

## ✅ What's Been Implemented:

- **6-digit verification code** sent to user's email after registration
- **Beautiful verification page** with auto-focus inputs
- **Resend code functionality** with 60-second cooldown
- **Code expiration** (10 minutes)
- **Backend email service** with nodemailer
- **Database schema updated** with verification fields

## 📋 Setup Steps:

### Step 1: Update Database Schema

You need to add the verification columns to the users table.

**Using pgAdmin 4:**
1. Open pgAdmin 4
2. Right-click on `booking_system_db` database → Query Tool
3. Open file: `booking-system-backend/migrations/add_email_verification.sql`
4. Click Execute (F5)

**OR using SQL directly in pgAdmin:**
```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code);
```

### Step 2: Configure Email Settings

Open `booking-system-backend/.env` and update email configuration:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=masterdschool219@gmail.com
EMAIL_PASSWORD=rtux hobm vmfn xsal
EMAIL_FROM=Master Driving School <noreply@masterdrivingschool.com>
```

**📧 To Get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification (if not enabled)
3. Search for "App passwords"
4. Generate app password for "Mail"
5. Copy the 16-character password
6. Paste it in `EMAIL_PASSWORD` in .env

**Alternative for Testing (Console Output):**
If you don't want to set up email yet, the code will be printed in the backend terminal console for testing.

### Step 3: Restart Backend Server

```cmd
cd "c:\Users\Lance Vidallon\Desktop\Booking System\booking-system-backend"
```

Press `Ctrl+C` to stop, then:
```cmd
npm run dev
```

## 🎯 How It Works:

### Registration Flow:
1. User fills signup form → clicks "Create Account"
2. Backend:
   - Creates user with `is_verified = false`
   - Generates 6-digit code
   - Saves code + expiration (10 min) to database
   - Sends email with code
3. Frontend redirects to Verification page
4. User enters 6-digit code
5. Backend verifies code → marks user as verified → returns JWT token
6. User is logged in → redirected to Booking page

### Login Flow with Unverified Email:
1. User tries to login
2. Backend checks if `is_verified = true`
3. If false → returns error
4. Frontend redirects to Verification page
5. User can resend code or verify

## 🧪 Testing:

### Test 1: New Registration

1. Go to http://localhost:5174
2. Click "Book Now" → "Sign Up"
3. Fill in all fields (use a real email if you configured Gmail)
4. Click "Create Account"
5. **Check backend terminal** - you'll see:
   ```
   ✅ Verification email sent to: user@email.com
   ```
6. Check your email for the 6-digit code
7. Enter the code on verification page
8. Should log you in and redirect to Booking

### Test 2: Resend Code

1. On verification page, wait 60 seconds
2. Click "Resend Code"
3. Check email for new code
4. Enter new code

### Test 3: Login with Unverified Email

1. Register but don't verify
2. Go back to Sign In
3. Try to log in
4. Should redirect to verification page

### Test Without Email (Development):

If you haven't configured Gmail, check the **backend terminal** - the verification code is logged there:

```
✅ Verification email sent to: user@email.com
Generated code: 123456
```

## 🎨 UI Features:

- ✨ 6 separate input boxes for code digits
- ⌨️ Auto-focus next box on input
- 📋 Paste support (paste all 6 digits at once)
- ⬅️ Backspace navigation
- ⏱️ Countdown timer for resend (60 seconds)
- 🔄 Resend button
- ❌ Error messages
- ✅ Success validation

## 📁 New Files Created:

**Backend:**
- `utils/emailService.js` - Email sending logic
- `migrations/add_email_verification.sql` - Database schema update

**Frontend:**
- `pages/VerifyEmail.jsx` - Verification page component

**Updated Files:**
- `controllers/authController.js` - Added verification logic
- `routes/auth.js` - Added verification endpoints
- `services/api.js` - Added verification API calls
- `App.jsx` - Added verification route
- `SignUp.jsx` - Redirects to verification
- `SignIn.jsx` - Checks verification status
- `.env` - Added email configuration

## 🔒 Security Features:

- ✅ Codes expire after 10 minutes
- ✅ Codes are cleared after successful verification
- ✅ Rate limiting on resend (60 seconds)
- ✅ Only verified users can log in
- ✅ Secure random 6-digit code generation

## 🐛 Troubleshooting:

**"Email sending failed"**
- Check Gmail app password is correct
- Make sure 2-Step Verification is enabled
- Check EMAIL_USER and EMAIL_PASSWORD in .env

**"Invalid verification code"**
- Code may have expired (10 minutes)
- Click "Resend Code"
- Check you entered all 6 digits correctly

**Backend errors:**
- Make sure database migration ran successfully
- Check that `is_verified`, `verification_code` columns exist in users table

## 📧 Email Template:

The verification email includes:
- Professional Master Driving School branding
- Large, clear 6-digit code
- Expiration notice (10 minutes)
- User's first name personalization

Enjoy your secure email verification system! 🎉
