# Booking System Setup Guide

## Complete PostgreSQL Database Integration

### Prerequisites
- PostgreSQL installed on your system
- Node.js and npm installed
- Both frontend and backend folders ready

## Quick Start Guide

### Step 1: PostgreSQL Setup

#### Option A: Using pgAdmin 4 (Recommended for Windows)

1. **Open pgAdmin 4**
2. **Create Database:**
   - Right-click on "Databases" → Create → Database
   - Name: `booking_system`
   - Click Save

3. **Run Database Schema:**
   - Right-click on `booking_system` database → Query Tool
   - Open: `booking-system-backend/database.sql`
   - Click Execute (F5)
   - You should see: "Query returned successfully"

#### Option B: Using Command Line

```cmd
# Navigate to backend folder
cd "c:\Users\Lance Vidallon\Desktop\Booking System\booking-system-backend"

# Create database
psql -U postgres -c "CREATE DATABASE booking_system;"

# Run schema
psql -U postgres -d booking_system -f database.sql
```

### Step 2: Configure Backend

1. **Update `.env` file** (already created):
   - Open: `booking-system-backend/.env`
   - Update `DB_PASSWORD` to match your PostgreSQL password
   - Default is `postgres` - change if yours is different

2. **Test database connection:**
```cmd
cd "c:\Users\Lance Vidallon\Desktop\Booking System\booking-system-backend"
npm start
```

You should see:
```
✅ Database connected successfully
🚀 Server is running on http://localhost:5000
```

### Step 3: Start Backend Server

```cmd
cd "c:\Users\Lance Vidallon\Desktop\Booking System\booking-system-backend"
npm run dev
```

Leave this terminal running!

### Step 4: Start Frontend

Open a NEW terminal:

```cmd
cd "c:\Users\Lance Vidallon\Desktop\Booking System\booking-system-frontend"
npm run dev
```

The app will run on http://localhost:5174

## Testing the Integration

### 1. Test Registration
- Go to http://localhost:5174
- Click "Book Now" (should redirect to Sign In)
- Click "Sign Up"
- Fill in all required fields
- Click "Create Account"
- Should redirect to Booking page (you're now logged in!)

### 2. Test Login
- Logout (or open incognito window)
- Click "Book Now"
- Enter your registered email and password
- Click "Sign In"
- Should redirect to Booking page

### 3. Verify Database
In pgAdmin:
- Right-click `booking_system` → Query Tool
- Run: `SELECT * FROM users;`
- You should see your registered user!

## API Endpoints Available

### Public Endpoints
- `GET /api/courses` - List all courses
- `GET /api/branches` - List all branches
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Protected Endpoints (Requires Authentication)
- `GET /api/auth/profile` - Get user profile
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get user bookings
- `PATCH /api/bookings/:id/status` - Update booking
- `DELETE /api/bookings/:id` - Delete booking

## Troubleshooting

### Issue: "Database connection failed"
**Solution:**
1. Check if PostgreSQL is running (Services → postgresql-x64-XX)
2. Verify password in `.env` file
3. Ensure database `booking_system` exists

### Issue: "Port 5000 already in use"
**Solution:**
1. Change PORT in `.env` to 5001
2. Update frontend `.env`: `VITE_API_URL=http://localhost:5001/api`

### Issue: "Cannot connect to API"
**Solution:**
1. Ensure backend is running on port 5000
2. Check browser console for CORS errors
3. Verify `.env` file in frontend has correct API URL

### Issue: "Login/Register not working"
**Solution:**
1. Open browser Developer Tools (F12)
2. Check Console tab for errors
3. Check Network tab to see API responses
4. Verify backend terminal shows the API requests

## Database Schema

### Tables Created:
- ✅ **users** - User accounts with full profile info
- ✅ **courses** - Driving courses (4 sample courses included)
- ✅ **branches** - School locations (3 sample branches included)
- ✅ **bookings** - User course bookings
- ✅ **cart_items** - Shopping cart data

## What's Working Now:

✅ PostgreSQL database integrated
✅ User registration with password hashing (bcrypt)
✅ User login with JWT authentication
✅ Token-based session management
✅ Protected routes requiring authentication
✅ Book Now button checks login status
✅ Auto-redirect to booking after authentication
✅ Sample courses and branches pre-loaded

## Next Steps to Implement:

- [ ] Connect Courses page to database
- [ ] Connect Branches page to database
- [ ] Implement actual booking flow
- [ ] Create user dashboard
- [ ] Add booking history page
- [ ] Implement password reset functionality
- [ ] Add admin panel for managing courses/bookings

## Development Tips

### Backend Terminal (Port 5000)
```
✅ Database connected successfully
POST /api/auth/register 201 - - 234.567 ms
POST /api/auth/login 200 - - 123.456 ms
```

### Frontend Terminal (Port 5174)
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5174/
```

### Check API Health
```cmd
curl http://localhost:5000/api/health
```

Response: `{"status":"ok","message":"Server is running"}`

## Important Files

### Backend
- `server.js` - Main server file
- `config/db.js` - Database connection
- `controllers/authController.js` - Authentication logic
- `routes/` - API endpoints
- `.env` - Configuration (DO NOT commit to git!)

### Frontend
- `src/services/api.js` - API client
- `src/pages/SignIn.jsx` - Login page
- `src/pages/SignUp.jsx` - Registration page
- `src/App.jsx` - Main app with auth state

## Security Notes

⚠️ **IMPORTANT:**
- Change `JWT_SECRET` in `.env` before production
- Never commit `.env` file to version control
- Use HTTPS in production
- Implement rate limiting for APIs
- Add email verification for registration
