# Course Management Database Setup

This guide explains how to reset the courses database and connect Course Management to the database.

## What Was Done

### Backend Changes

1. **Database Schema** ([database.sql](../database.sql))
   - Added `category` column (VARCHAR(50), default: 'Basic')
   - Added `status` column (VARCHAR(50), default: 'active')

2. **Course Controller** ([controllers/courseController.js](../controllers/courseController.js))
   - ✅ `createCourse` - Create new courses
   - ✅ `updateCourse` - Update existing courses
   - ✅ `deleteCourse` - Delete courses
   - All with proper validation and error handling

3. **Course Routes** ([routes/courses.js](../routes/courses.js))
   - `POST /api/courses` - Create course (Admin only)
   - `PUT /api/courses/:id` - Update course (Admin only)
   - `DELETE /api/courses/:id` - Delete course (Admin only)
   - Protected with authentication and admin role check

4. **Scripts Created**
   - `resetCourses.js` - Delete all courses and reset ID sequence
   - `setupCourses.js` - Complete setup (add columns, reset data)

### Frontend Changes

1. **API Service** ([services/api.js](../../booking-system-frontend/src/services/api.js))
   - `coursesAPI.create()` - Create courses
   - `coursesAPI.update()` - Update courses
   - `coursesAPI.delete()` - Delete courses

2. **Course Management** ([admin/CourseManagement.jsx](../../booking-system-frontend/src/admin/CourseManagement.jsx))
   - ✅ Connected to real database API
   - ✅ Removed mock data
   - ✅ All CRUD operations working
   - ✅ Error handling added

## How to Run the Setup

### Option 1: Complete Setup (Recommended)

This adds columns, deletes all courses, and resets the ID sequence:

```bash
cd booking-system-backend
node scripts/setupCourses.js
```

### Option 2: Just Reset Courses

If you already have the columns, just delete and reset:

```bash
cd booking-system-backend
node scripts/resetCourses.js
```

### Option 3: Manual SQL Migration

Run the migration file in pgAdmin or psql:

```bash
psql -U postgres -d booking_system -f migrations/add_course_category_status.sql
```

Then optionally reset:
```bash
node scripts/resetCourses.js
```

## Testing the Setup

1. **Start Backend**
   ```bash
   cd booking-system-backend
   npm start
   ```

2. **Start Frontend**
   ```bash
   cd booking-system-frontend
   npm run dev
   ```

3. **Test Course Management**
   - Login as Admin/HRM/Staff
   - Navigate to Course Management
   - Try adding a new course
   - Edit and delete courses
   - Search and filter courses

## Database Schema

```sql
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration VARCHAR(100),
    category VARCHAR(50) DEFAULT 'Basic',
    status VARCHAR(50) DEFAULT 'active',
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Public
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get single course

### Admin Only (Requires Authentication)
- `POST /api/courses` - Create course
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

## Features

✅ Full CRUD operations
✅ Role-based access control (Admin, HRM, Staff)
✅ Category and status fields
✅ Multiple image support (stored as JSON)
✅ Real-time data sync
✅ Error handling and validation
✅ Search and filter functionality

## Troubleshooting

**Error: Column "category" does not exist**
- Run `node scripts/setupCourses.js` to add the columns

**Error: 403 Access Denied**
- Make sure you're logged in as Admin, HRM, or Staff

**Courses not showing**
- Check backend console for errors
- Verify database connection
- Run `setupCourses.js` to reset

**ID sequence issues**
- Run `node scripts/resetCourses.js` to reset the sequence
