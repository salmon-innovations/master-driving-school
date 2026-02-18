-- Create roles table for advanced role management
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed initial roles
INSERT INTO roles (name, display_name, description, is_system) VALUES 
('admin', 'Administrator', 'Full system access and configuration management', TRUE),
('staff', 'Staff Member', 'Daily operations, bookings, and customer management', TRUE),
('instructor', 'Instructor', 'Schedule management and student progress tracking', TRUE),
('student', 'Student', 'Standard access for bookings and profile management', TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Create system_settings table for global configurations
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    `key` VARCHAR(100) NOT NULL UNIQUE,
    `value` TEXT,
    `group` VARCHAR(50) DEFAULT 'general',
    description TEXT,
    type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed initial system settings
INSERT INTO system_settings (`key`, `value`, `group`, `description`, `type`) VALUES 
('site_name', 'Master Driving School', 'branding', 'The display name of the application', 'text'),
('maintenance_mode', 'false', 'system', 'Set the site to maintenance mode', 'boolean'),
('auto_verify_enrollment', 'true', 'workflow', 'Automatically verify enrollments after payment', 'boolean'),
('contact_email', 'support@masterdriving.school', 'contact', 'Primary support contact email', 'text'),
('phone_number', '+63 9 123 456 789', 'contact', 'Primary contact phone number', 'text')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Create permissions table (optional, for future scalability)
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link roles to permissions (optional)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT,
    permission_id INT,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
