-- Setup Database for Incoming Warehouse System
-- Run this script as PostgreSQL superuser (postgres)
-- Usage: psql -U postgres -h localhost -f setup-database.sql

-- Create user admin (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'admin') THEN
        CREATE USER admin WITH PASSWORD 'admin123';
        RAISE NOTICE 'User admin created';
    ELSE
        RAISE NOTICE 'User admin already exists';
    END IF;
END
$$;

-- Create database (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wis_foom') THEN
        CREATE DATABASE wis_foom OWNER admin;
        RAISE NOTICE 'Database wis_foom created';
    ELSE
        RAISE NOTICE 'Database wis_foom already exists';
    END IF;
END
$$;

-- Grant privileges on database
GRANT ALL PRIVILEGES ON DATABASE wis_foom TO admin;
