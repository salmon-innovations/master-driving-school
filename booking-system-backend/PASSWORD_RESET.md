# PostgreSQL Password Reset Guide

## Method 1: Reset via SQL Shell (psql)

1. Open "SQL Shell (psql)" from Start Menu
2. Press Enter for default values (Server, Database, Port, Username)
3. Enter your current password (or the one you remember)
4. Run this command:
   ```sql
   ALTER USER postgres PASSWORD 'newpassword123';
   ```
5. Exit: `\q`

## Method 2: Reset via pgAdmin 4

1. Open pgAdmin 4
2. Right-click on "PostgreSQL XX" server → Properties
3. Go to "Connection" tab
4. Update the password
5. Save

## Method 3: Edit pg_hba.conf (If completely locked out)

1. Find pg_hba.conf file (usually in: C:\Program Files\PostgreSQL\XX\data\)
2. Open as Administrator
3. Find line: `host    all             all             127.0.0.1/32            scram-sha-256`
4. Change to: `host    all             all             127.0.0.1/32            trust`
5. Save and restart PostgreSQL service:
   - Open Services (services.msc)
   - Find "postgresql-x64-XX"
   - Right-click → Restart
6. Now you can connect without password and reset it:
   ```cmd
   psql -U postgres
   ALTER USER postgres PASSWORD 'newpassword123';
   ```
7. Change pg_hba.conf back to `scram-sha-256`
8. Restart PostgreSQL service again

## After Resetting Password

Update the .env file with your new password and restart the backend server.
