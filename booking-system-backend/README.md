# Booking System Backend

Backend API for Master Driving School Booking System built with Node.js, Express, and PostgreSQL.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the database credentials in `.env`:
     ```
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=booking_system
     DB_USER=postgres
     DB_PASSWORD=your_password
     JWT_SECRET=your_secret_key
     ```

## Database Setup

### Option 1: Using psql command line

1. **Create the database:**
```bash
psql -U postgres
CREATE DATABASE booking_system;
\q
```

2. **Run the schema:**
```bash
psql -U postgres -d booking_system -f database.sql
```

### Option 2: Using pgAdmin

1. Open pgAdmin 4
2. Right-click on "Databases" → Create → Database
3. Name it `booking_system`
4. Right-click on the new database → Query Tool
5. Open and execute `database.sql`

### Option 3: Using Windows Command Prompt

```cmd
# Create database
psql -U postgres -c "CREATE DATABASE booking_system;"

# Run schema
psql -U postgres -d booking_system -f database.sql
```

## Database Schema

The database includes these tables:
- **users** - User accounts with personal information
- **courses** - Available driving courses
- **branches** - Driving school locations
- **bookings** - User course bookings
- **cart_items** - Temporary shopping cart storage

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (requires auth)

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get course by ID

### Branches
- `GET /api/branches` - Get all branches
- `GET /api/branches/:id` - Get branch by ID

### Bookings (requires authentication)
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get user's bookings
- `GET /api/bookings/:id` - Get booking by ID
- `PATCH /api/bookings/:id/status` - Update booking status
- `DELETE /api/bookings/:id` - Delete booking

## Testing the API

### Check server health:
```bash
curl http://localhost:5000/api/health
```

### Register a user:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"firstName\":\"John\",\"lastName\":\"Doe\",\"email\":\"john@example.com\",\"password\":\"password123\"}"
```

### Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"john@example.com\",\"password\":\"password123\"}"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| DB_NAME | Database name | booking_system |
| DB_USER | Database user | postgres |
| DB_PASSWORD | Database password | - |
| JWT_SECRET | JWT signing secret | - |

## Deploying to DigitalOcean

This repository is now prepared for DigitalOcean App Platform + Managed PostgreSQL.

- App spec file: `.do/app.yaml`
- Backend deployment guide: `booking-system-backend/DIGITALOCEAN_DEPLOYMENT.md`
- Production env template: `booking-system-backend/.env.digitalocean.example`

Quick summary:

1. Create a Managed PostgreSQL cluster in DigitalOcean.
2. Set backend environment variables (especially `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET`).
3. Deploy backend using `.do/app.yaml` (or App Platform UI with source dir `booking-system-backend`).
4. Confirm health endpoint: `/api/health`.

### DigitalOcean DB SSL

The backend now supports DB SSL toggles:

- `DB_SSL=true`
- `DB_SSL_REJECT_UNAUTHORIZED=false`

For DigitalOcean Managed PostgreSQL, use SSL-enabled `DATABASE_URL` (`sslmode=require`) and keep `DB_SSL=true`.
| JWT_EXPIRE | JWT expiration time | 7d |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:5174 |

## Troubleshooting

### Database connection issues:
- Ensure PostgreSQL is running
- Verify credentials in `.env`
- Check if the database exists
- Ensure PostgreSQL is listening on the correct port

### Port already in use:
- Change PORT in `.env` file
- Or kill the process using port 5000:
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  ```

## Project Structure

```
booking-system-backend/
├── config/
│   └── db.js              # Database connection
├── controllers/
│   ├── authController.js  # Authentication logic
│   ├── bookingController.js
│   ├── courseController.js
│   └── branchController.js
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   ├── auth.js
│   ├── bookings.js
│   ├── courses.js
│   └── branches.js
├── .env                   # Environment variables (create this)
├── .env.example           # Environment template
├── database.sql           # Database schema
├── package.json
└── server.js              # Main application file
```
