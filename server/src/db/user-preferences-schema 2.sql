-- User Preferences Schema
-- Adds per-user preferences (currency, regional settings) to the users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en-AU';
