-- Create Database (run this first if database doesn't exist)
-- CREATE DATABASE booking_system;

-- Connect to booking_system database before running the rest

-- Branches Table (must be created first due to foreign key in users table)
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    contact_number VARCHAR(50),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL, 
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    address TEXT,
    age INTEGER,
    gender VARCHAR(20),
    birthday DATE,
    birth_place VARCHAR(255),
    nationality VARCHAR(100),
    marital_status VARCHAR(50),
    contact_numbers TEXT,
    zip_code VARCHAR(20),
    emergency_contact_person VARCHAR(255),
    emergency_contact_number VARCHAR(50),
    role VARCHAR(50) DEFAULT 'student' CHECK (role IN ('admin', 'staff', 'student', 'walkin_student')),
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active',
    last_login TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires TIMESTAMP,
    reset_otp VARCHAR(6),
    reset_otp_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses Table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    duration VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    category VARCHAR(50) DEFAULT 'Basic',
    course_type VARCHAR(50),
    pricing_data JSONB,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT courses_category_check CHECK (category IN ('TDC', 'PDC', 'Basic'))
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
    booking_date DATE NOT NULL,
    booking_time TIME,
    status VARCHAR(50) DEFAULT 'collectable',
    notes TEXT,
    total_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cart Items Table (for temporary storage)
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- Add comments for documentation
COMMENT ON COLUMN users.role IS 'User role: admin, staff, student, or walkin_student';
COMMENT ON COLUMN users.branch_id IS 'Foreign key to branches table for admin/staff users';
COMMENT ON COLUMN users.status IS 'Account status: active or inactive';
COMMENT ON COLUMN users.is_verified IS 'Email verification status';
COMMENT ON COLUMN courses.status IS 'Course status: active or inactive';
COMMENT ON COLUMN courses.image_url IS 'JSON array of image URLs or single image URL';

-- Insert sample courses
INSERT INTO courses (name, description, price, duration, image_url) VALUES
('Student Permit Course', 'Complete theoretical and practical training for student permit', 5000.00, '2 weeks', '/images/student-permit.jpg'),
('Professional Driver Course', 'Advanced driving course for professional drivers', 15000.00, '1 month', '/images/professional.jpg'),
('Defensive Driving Course', 'Learn defensive driving techniques and safety', 8000.00, '3 weeks', '/images/defensive.jpg'),
('Motorcycle Training', 'Complete motorcycle handling and safety training', 6000.00, '2 weeks', '/images/motorcycle.jpg')
ON CONFLICT DO NOTHING;

-- Insert sample branches
INSERT INTO branches (name, address, contact_number) VALUES
('Master Driving School V-luna Main Branch', 'Unit 205-206 V-luna cor East Ave, Brgy Pinyahan, Quezon City', '0915 644 9441'),
('Master Driving School Antipolo Branch', 'Ellimac Building, Puregold Circumferential Road, San Roque, Antipolo City', '0967 427 0198'),
('Master Driving School Mandaluyong Branch', 'ACME Bldg. 373 Boni Avenue, Brgy. Malamig, Mandaluyong City', '0906 450 5197 / 0962 134 7068'),
('Master Driving School Marikina Branch', '374 JP Rizal St., Marikina City', '0966 291 4687 / 0996 084 5626'),
('Master Driving School Pasig Branch', '9001 Felix Ave. Cor. Jasmin St. Pasig City', '0945 834 4002 / 0969 632 5887'),
('Master Prime Driving School Meycauayan Branch', 'UNIT A1-B2, JRJ BUILDING, Barangay, CAMALIG, Meycauayan, 3020 Bulacan', '0945 461 5171 / 0962 058 4898'),
('Master Driving School Malabon Branch', '2nd Floor RLN Centre, Governor Pascual Avenue, Malabon, Metro Manila, Philippines', '0961 807 3526 / 0926 693 7265'),
('Masters Prime Holdings Corp. Binan Branch', 'San Antonio Nat''l Hi-way, Binan, Laguna', '0912 595 2830'),
('Master Prime Holdings Corp. Las Piñas Branch', 'Unit 5, Triple B Bldg, Alabang-Zapote Rd, Talon Uno, Las Piñas, 1740 Metro Manila', '0908 388 9144'),
('Master Prime Driving School Bacoor Branch', '2nd Floor SICI Cavite Business Center Lot 4A Aguinaldo Highway, Habay 1, Bacoor, Cavite', '0954 184 2771 / 0968 365 9492'),
('Master Driving School San Mateo Branch', '101 General Luna Street, Ampid 1, San Mateo, Rizal, Philippines', '0966 288 6010'),
('Master Driving School Valenzuela Branch', '304 McArthur Hi-way, Malinta, Valenzuela City', '0953 284 8563'),
('Master Driving School Bocaue Bulacan Branch', '1594 McArthur Hi-way, Lolomboy, Bocaue, Bulacan', '0945 461 5171')
ON CONFLICT DO NOTHING;
