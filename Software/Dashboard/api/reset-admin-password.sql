-- Reset password for admin user to match .env file
-- Run as: psql -U postgres -h localhost -f reset-admin-password.sql

-- Reset admin user password to 'admin123'
ALTER USER admin WITH PASSWORD 'admin123';

-- Verify the user exists
SELECT usename, usesuper FROM pg_user WHERE usename = 'admin';
