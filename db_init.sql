-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL,
    phone VARCHAR(50),
    avatar TEXT,
    password_hash TEXT, -- Stores bcrypt hash "$2a$12$..."
    zoints_balance DECIMAL(10, 2) DEFAULT 0,
    total_recycled_kg DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    account_name VARCHAR(255),
    gender VARCHAR(50),
    address TEXT,
    industry VARCHAR(100),
    esg_score VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure password_hash column exists (Migration for existing tables)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
-- New Columns Migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS esg_score VARCHAR(10);

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
    rate DECIMAL(10, 2) NOT NULL,
    co2_saved_per_kg DECIMAL(10, 4) DEFAULT 0
);

-- Migration for new column
ALTER TABLE waste_rates ADD COLUMN IF NOT EXISTS co2_saved_per_kg DECIMAL(10, 4) DEFAULT 0;

-- Initial Rates with CO2 values (Approximate CO2 saved per kg recycled)
INSERT INTO waste_rates (category, rate, co2_saved_per_kg) VALUES 
('Plastic', 15.00, 1.5),
('Paper', 5.00, 0.9),
('Metal', 40.00, 5.0),
('Glass', 10.00, 0.3),
('Electronics', 100.00, 10.0),
('Organic', 2.00, 0.1)
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

-- Certificates Table (NEW)
CREATE TABLE IF NOT EXISTS certificates (
    id VARCHAR(255) PRIMARY KEY,
    org_id VARCHAR(255) REFERENCES users(id),
    org_name VARCHAR(255),
    month VARCHAR(50),
    year INT,
    url TEXT,
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
VALUES ('loc_1', 'Zilcycler HQ', 'Ilorin, Kwara State', '8:00 AM - 6:00 PM', 'https://maps.google.com', 8.5202, 4.5612)
ON CONFLICT (id) DO UPDATE SET 
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    address = EXCLUDED.address;

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
-- Password: password123
-- Hash: Bcrypt (cost 12) for 'password123'
INSERT INTO users (id, name, email, role, phone, avatar, zoints_balance, is_active, password_hash)
VALUES ('admin-1', 'System Admin', 'demo@zilcycler.com', 'ADMIN', '0000000000', 'https://i.pravatar.cc/150?u=admin', 0, TRUE, '$2a$12$rq9.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1.1')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
