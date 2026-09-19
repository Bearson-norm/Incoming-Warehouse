#!/bin/bash
# VPS PostgreSQL setup script (native install, not Docker)
# Run as: sudo bash vps-setup-db.sh

set -e

echo "=== Setting up PostgreSQL for Incoming Warehouse ==="

# Install PostgreSQL if not present
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    apt-get update
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi

# Create user and database
sudo -u postgres psql << 'EOSQL'
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

GRANT ALL PRIVILEGES ON DATABASE wis_foom TO admin;
\c wis_foom
GRANT ALL ON SCHEMA public TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
EOSQL

echo ""
echo "=== PostgreSQL setup complete ==="
echo "  Database: wis_foom"
echo "  User: admin"
echo "  Password: admin123"
echo ""
echo "Next steps:"
echo "  1. Run migrations: npx prisma migrate deploy"
echo "  2. Run seed: npm run prisma:seed"
echo "  Or restore from dump: pg_restore -U admin -d wis_foom --no-owner --no-acl wis_foom_backup.dump"
