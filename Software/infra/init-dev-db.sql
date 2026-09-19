-- One-time: create app DB user/database for local dev (matches Dashboard/api .env defaults).
-- Run as PostgreSQL superuser, e.g.:
--   psql -U postgres -h localhost -f infra/init-dev-db.sql
-- From repo root: Software

CREATE ROLE admin WITH LOGIN PASSWORD 'admin123';
CREATE DATABASE wis_foom OWNER admin;
