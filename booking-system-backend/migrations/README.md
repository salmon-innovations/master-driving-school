# Database Migrations

This folder contains SQL migration scripts to update existing databases.

## How to Apply Migrations

### For Existing Databases

If you have an existing database, apply migrations in the following order:

1. **add_email_verification.sql** - Adds email verification columns
2. **add_user_role_and_branch.sql** - Adds role, branch, status, and last_login columns
3. **add_user_management_columns.sql** - Adds additional user management columns
4. **fix_branch_addresses.sql** - Updates branch addresses
5. **update_role_constraint.sql** - Adds CHECK constraint for roles (admin, hrm, staff, student)

### To Apply a Migration

Connect to your PostgreSQL database and run:

```bash
psql -U your_username -d booking_system -f migrations/update_role_constraint.sql
```

Or using a database client, copy and paste the SQL from the migration file.

### For New Installations

Use the main `database.sql` file which includes all migrations. It has:
- Proper table ordering (branches created before users)
- Role constraint: admin, hrm (HR Manager), staff, student
- All necessary columns and indexes
- Sample data for courses and branches

## Latest Migration: update_role_constraint.sql

This migration:
- Adds CHECK constraint to ensure only valid roles: `admin`, `hrm`, `staff`, `student`
- Updates any invalid/NULL roles to 'student'
- Adds documentation comment on the role column
- **HRM** stands for **HR Manager** - a new role with admin privileges for HR operations

## Role Descriptions

- **admin**: Full system access, super administrator
- **hrm**: HR Manager - manages users, staff, and HR operations
- **staff**: Staff members with limited admin access
- **student**: Regular students who book courses

## Verifying Migration

After applying migrations, verify with:

```sql
-- Check role constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public' 
  AND constraint_name = 'users_role_check';

-- Check existing roles
SELECT DISTINCT role FROM users;

-- View table structure
\d users
```
