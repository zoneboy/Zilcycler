-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    avatar TEXT,
    password_hash TEXT, -- Stores "salt:hash"
    zoints_balance DECIMAL(10, 2) DEFAULT 0,
    total_recycled_kg DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    account_name VARCHAR(255),
    gender VARCHAR(50),
    address TEXT,
    industry VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure password_hash column exists (Migration for existing tables)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
-- New Columns Migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(100);

-- Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    email VARCHAR(255) PRIMARY KEY,
    otp VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

-- Pickups Table
CREATE TABLE IF NOT EXISTS pickups (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    location TEXT NOT NULL,
    time VARCHAR(50),
    date VARCHAR(50),
    items TEXT,
    status VARCHAR(50) DEFAULT 'Pending',
    contact VARCHAR(255),
    phone_number VARCHAR(50),
    waste_image TEXT,
    earned_zoints DECIMAL(10, 2) DEFAULT 0,
    weight DECIMAL(10, 2) DEFAULT 0,
    collection_details JSONB,
    driver VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Config Table
CREATE TABLE IF NOT EXISTS system_config (
    id SERIAL PRIMARY KEY,
    maintenance_mode BOOLEAN DEFAULT FALSE,
    allow_registrations BOOLEAN DEFAULT TRUE
);

-- Ensure default config exists
INSERT INTO system_config (id, maintenance_mode, allow_registrations)
VALUES (1, FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Waste Rates Table
CREATE TABLE IF NOT EXISTS waste_rates (
    category VARCHAR(100) PRIMARY KEY,
    rate DECIMAL(10, 2) NOT NULL
);

-- Initial Rates
INSERT INTO waste_rates (category, rate) VALUES 
('Plastic', 15.00),
('Paper', 5.00),
('Metal', 40.00),
('Glass', 10.00),
('Electronics', 100.00),
('Organic', 2.00)
ON CONFLICT (category) DO NOTHING;

-- Redemption Requests Table
CREATE TABLE IF NOT EXISTS redemption_requests (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    user_name VARCHAR(255),
    type VARCHAR(50),
    amount DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'Pending',
    date VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blog Posts Table
CREATE TABLE IF NOT EXISTS blog_posts (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    excerpt TEXT,
    image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drop Off Locations Table
CREATE TABLE IF NOT EXISTS drop_off_locations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    open_hours VARCHAR(100),
    map_url TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8)
);

-- Default Location
INSERT INTO drop_off_locations (id, name, address, open_hours, map_url, lat, lng)
VALUES ('loc_1', 'Zilcycler HQ', '123 Green St, Lagos', '8:00 AM - 6:00 PM', 'https://maps.google.com', 6.5244, 3.3792)
ON CONFLICT (id) DO NOTHING;

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    sender_id VARCHAR(255) REFERENCES users(id),
    receiver_id VARCHAR(255) REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE
);

-- Default Admin User
-- Email: demo@zilcycler.com
-- Password: password123 (Hash generated for demo purposes)
INSERT INTO users (id, name, email, role, phone, avatar, zoints_balance, is_active, password_hash)
VALUES ('admin-1', 'System Admin', 'demo@zilcycler.com', 'ADMIN', '0000000000', 'https://i.pravatar.cc/150?u=admin', 0, TRUE, 'bed4f2a74c7e6c921350123567890123:3f2b7a8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6')
ON CONFLICT (email) DO NOTHING;