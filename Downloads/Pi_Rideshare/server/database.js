const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Production-optimized database connection pool
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  // Production settings for better performance and reliability
  max: isProduction ? 50 : 20, // More connections in production
  min: isProduction ? 10 : 2,  // Keep minimum connections open
  idleTimeoutMillis: isProduction ? 10000 : 30000,
  connectionTimeoutMillis: isProduction ? 5000 : 10000, 
  acquireTimeoutMillis: isProduction ? 5000 : 10000,
  createTimeoutMillis: isProduction ? 5000 : 10000,
  destroyTimeoutMillis: isProduction ? 3000 : 5000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 2000,
  // Production query logging
  log: isProduction ? false : (msg) => console.log('DB Log:', msg),
});

// Database schema initialization
const initializeDatabase = async () => {
  console.log('🔄 Initializing database connection...');

  if (!process.env.DATABASE_URL) {
    console.log('⚠️  No DATABASE_URL found. Using development mode without database.');
    return;
  }

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connection established successfully');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        user_type VARCHAR(20) DEFAULT 'rider',
        is_verified BOOLEAN DEFAULT false,
        rating DECIMAL(3,2) DEFAULT 5.0,
        total_rides INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Rides table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rider_id UUID REFERENCES users(id),
        driver_id UUID REFERENCES users(id),
        pickup_address TEXT NOT NULL,
        pickup_lat DECIMAL(10,8) NOT NULL,
        pickup_lng DECIMAL(11,8) NOT NULL,
        destination_address TEXT NOT NULL,
        destination_lat DECIMAL(10,8) NOT NULL,
        destination_lng DECIMAL(11,8) NOT NULL,
        ride_type VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'requested',
        scheduled_time TIMESTAMP,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        estimated_fare JSONB,
        final_fare DECIMAL(10,2),
        tip_amount DECIMAL(10,2) DEFAULT 0,
        payment_method_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add stripe_customer_id to users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
    `);

    // Add profile fields to users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS music_preference BOOLEAN DEFAULT true;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS conversation_preference BOOLEAN DEFAULT false;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS temperature_preference VARCHAR(20) DEFAULT 'cool';
    `);

    // Add payment processing columns to rides table
    await client.query(`
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
    `);
    await client.query(`
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);
    `);
    await client.query(`
      ALTER TABLE rides ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2);
    `);

    // Payment methods table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        stripe_pm_id VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        brand VARCHAR(20),
        last4 VARCHAR(4),
        exp_month INTEGER,
        exp_year INTEGER,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Payment transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id UUID REFERENCES rides(id),
        stripe_payment_intent_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'usd',
        status VARCHAR(50) NOT NULL,
        transaction_type VARCHAR(20) NOT NULL, -- 'fare', 'tip', 'refund'
        stripe_fee DECIMAL(10,2),
        net_amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Plaid accounts table for bank verification
    await client.query(`
      CREATE TABLE IF NOT EXISTS plaid_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        access_token TEXT NOT NULL,
        item_id VARCHAR(255) NOT NULL,
        institution_id VARCHAR(255) NOT NULL,
        institution_name VARCHAR(255) NOT NULL,
        account_metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Refunds table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id UUID REFERENCES rides(id),
        payment_transaction_id UUID REFERENCES payment_transactions(id),
        stripe_refund_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reason VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Driver locations table (for real-time tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id) UNIQUE,
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        heading DECIMAL(6,3),
        speed DECIMAL(5,2),
        is_available BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id UUID REFERENCES rides(id),
        sender_id UUID REFERENCES users(id),
        recipient_id UUID REFERENCES users(id),
        message_text TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );
    `);

    // Driver earnings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_earnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id),
        ride_id UUID REFERENCES rides(id),
        base_fare DECIMAL(10,2) NOT NULL,
        tip_amount DECIMAL(10,2) DEFAULT 0,
        bonus_amount DECIMAL(10,2) DEFAULT 0,
        platform_fee DECIMAL(10,2) NOT NULL,
        surge_multiplier DECIMAL(3,2) DEFAULT 1.0,
        total_earned DECIMAL(10,2) NOT NULL,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Driver payouts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_payouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        fee DECIMAL(10,2) DEFAULT 0,
        net_amount DECIMAL(10,2) NOT NULL,
        payout_method_id UUID,
        status VARCHAR(20) DEFAULT 'pending',
        initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        external_transaction_id VARCHAR(100),
        failure_reason TEXT
      );
    `);

    // Driver payout methods table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_payout_methods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id),
        method_type VARCHAR(20) NOT NULL,
        account_name VARCHAR(100),
        account_number_masked VARCHAR(20),
        routing_number_masked VARCHAR(20),
        is_default BOOLEAN DEFAULT false,
        is_verified BOOLEAN DEFAULT false,
        external_account_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tax documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id),
        tax_year INTEGER NOT NULL,
        document_type VARCHAR(20) NOT NULL,
        total_earnings DECIMAL(10,2) NOT NULL,
        total_fees DECIMAL(10,2) NOT NULL,
        net_earnings DECIMAL(10,2) NOT NULL,
        file_url TEXT,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_available BOOLEAN DEFAULT false
      );
    `);

    // Driver applications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        date_of_birth DATE NOT NULL,
        ssn_encrypted TEXT NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100),
        state VARCHAR(50),
        zip_code VARCHAR(20),

        -- License Information
        license_number VARCHAR(50) NOT NULL,
        license_state VARCHAR(50),
        license_valid_until DATE NOT NULL,
        license_image_url TEXT,

        -- Vehicle Information
        vehicle_make VARCHAR(50) NOT NULL,
        vehicle_model VARCHAR(50) NOT NULL,
        vehicle_year INTEGER NOT NULL,
        license_plate VARCHAR(20) NOT NULL,
        vehicle_color VARCHAR(30),
        vehicle_vin VARCHAR(17),

        -- Insurance Information
        insurance_company VARCHAR(100) NOT NULL,
        policy_number VARCHAR(100) NOT NULL,
        insurance_expiry_date DATE NOT NULL,
        insurance_image_url TEXT,

        -- Registration Information
        registration_expiry_date DATE NOT NULL,
        registration_image_url TEXT,

        -- Banking Information (encrypted)
        bank_name VARCHAR(100) NOT NULL,
        routing_number_encrypted TEXT NOT NULL,
        account_number_encrypted TEXT NOT NULL,
        account_holder_name VARCHAR(100) NOT NULL,

        -- Emergency Contact
        emergency_contact_name VARCHAR(100),
        emergency_contact_phone VARCHAR(20),

        -- Application Status
        application_status VARCHAR(30) DEFAULT 'pending_review',
        background_check_status VARCHAR(30) DEFAULT 'pending',
        documents_status VARCHAR(30) DEFAULT 'pending',
        vehicle_inspection_status VARCHAR(30) DEFAULT 'pending',

        -- Consents
        background_check_consent BOOLEAN NOT NULL DEFAULT false,
        data_processing_consent BOOLEAN NOT NULL DEFAULT false,
        terms_accepted BOOLEAN NOT NULL DEFAULT false,

        -- Additional Documents
        profile_photo_url TEXT,

        -- Timestamps
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP,

        -- Review Notes
        review_notes TEXT,
        rejection_reason TEXT,

        -- Admin who reviewed
        reviewed_by UUID REFERENCES users(id),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Application status history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_application_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES driver_applications(id),
        status_from VARCHAR(30),
        status_to VARCHAR(30) NOT NULL,
        changed_by UUID REFERENCES users(id),
        change_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Application documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_application_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES driver_applications(id),
        document_type VARCHAR(50) NOT NULL, -- 'license', 'insurance', 'registration', 'profile_photo'
        file_url TEXT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        upload_status VARCHAR(20) DEFAULT 'uploaded',
        verification_status VARCHAR(20) DEFAULT 'pending',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Corporate Discount System Tables
    
    // Corporations table - Stores company information and discount settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS corporations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name VARCHAR(255) NOT NULL UNIQUE,
        company_email VARCHAR(255),
        contact_person VARCHAR(255),
        contact_phone VARCHAR(20),
        
        -- Discount Configuration
        discount_type VARCHAR(20) DEFAULT 'percentage', -- 'percentage' or 'fixed_amount'
        discount_value DECIMAL(10,2) NOT NULL, -- 15.00 for 15% or 5.00 for $5 off
        
        -- Valid Days Configuration (JSON array of day names)
        valid_days JSONB DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday"]',
        
        -- Date Range
        start_date DATE NOT NULL,
        end_date DATE,
        
        -- Status
        is_active BOOLEAN DEFAULT true,
        
        -- Additional Settings
        max_discount_amount DECIMAL(10,2), -- Cap for percentage discounts
        min_ride_amount DECIMAL(10,2), -- Minimum ride amount to qualify
        
        -- Admin tracking
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Corporate Applications table - Stores rider applications with work ID verification
    await client.query(`
      CREATE TABLE IF NOT EXISTS corporate_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rider_id UUID REFERENCES users(id) NOT NULL,
        corporation_id UUID REFERENCES corporations(id) NOT NULL,
        
        -- Application Details
        work_email VARCHAR(255) NOT NULL,
        employee_id VARCHAR(100),
        department VARCHAR(100),
        
        -- Work ID Verification
        work_id_image_url TEXT NOT NULL, -- Uploaded work ID photo
        
        -- Application Status
        status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        
        -- Review Information
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        rejection_reason TEXT,
        
        -- Approval Details
        approved_at TIMESTAMP,
        discount_start_date DATE,
        discount_end_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Ensure one application per rider per corporation
        UNIQUE(rider_id, corporation_id)
      );
    `);

    // Add corporate discount tracking to users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS active_corporate_discount UUID REFERENCES corporate_applications(id);
    `);

    // Corporate Discount Usage table - Track discount usage for analytics
    await client.query(`
      CREATE TABLE IF NOT EXISTS corporate_discount_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_id UUID REFERENCES rides(id) NOT NULL,
        corporate_application_id UUID REFERENCES corporate_applications(id) NOT NULL,
        corporation_id UUID REFERENCES corporations(id) NOT NULL,
        
        -- Discount Applied
        original_fare DECIMAL(10,2) NOT NULL,
        discount_amount DECIMAL(10,2) NOT NULL,
        final_fare DECIMAL(10,2) NOT NULL,
        
        -- Usage Details
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ride_day_of_week VARCHAR(10) NOT NULL -- 'monday', 'tuesday', etc.
      );
    `);

    // Badge Verification Records table
    await client.query(`
      CREATE TABLE IF NOT EXISTS badge_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        corporate_application_id UUID REFERENCES corporate_applications(id) NOT NULL,
        rider_id UUID REFERENCES users(id) NOT NULL,
        driver_id UUID REFERENCES users(id) NOT NULL,
        ride_id UUID REFERENCES rides(id),
        
        -- Verification Details
        verification_status VARCHAR(20) DEFAULT 'verified', -- 'verified', 'failed'
        badge_photo_verified BOOLEAN DEFAULT true,
        verification_notes TEXT,
        
        -- Expiry Extension
        previous_expiry_date DATE,
        new_expiry_date DATE NOT NULL,
        days_extended INTEGER NOT NULL,
        
        verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Chat Sessions table - AI Customer Support Chatbot
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) NOT NULL,
        user_type VARCHAR(20) NOT NULL, -- 'rider', 'driver', 'admin'
        session_context JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'active', -- 'active', 'ended', 'expired'
        end_reason VARCHAR(50), -- 'user_ended', 'timeout', 'escalated'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      );
    `);

    // Chat Messages table - Store conversation history
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(255) REFERENCES chat_sessions(id) NOT NULL,
        role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tokens_used INTEGER DEFAULT 0,
        intent_analysis JSONB -- Store AI analysis of user intent
      );
    `);

    // Create indexes for chat messages performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
    `);

// Driver Settings table - Store driver preferences
    await client.query(`
      CREATE TABLE IF NOT EXISTS driver_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_id UUID REFERENCES users(id) UNIQUE NOT NULL,
        voice_guidance BOOLEAN DEFAULT true,
        accept_cash BOOLEAN DEFAULT false,
        long_trips BOOLEAN DEFAULT true,
        pool_rides BOOLEAN DEFAULT true,
        auto_accept BOOLEAN DEFAULT false,
        accept_pets BOOLEAN DEFAULT false,
        accept_teens BOOLEAN DEFAULT false,
        notifications BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Admin Settings table - Admin-controlled options
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value BOOLEAN DEFAULT false,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert default admin settings
    await client.query(`
      INSERT INTO admin_settings (setting_key, setting_value, description)
      VALUES 
        ('cash_enabled', true, 'Allow drivers to accept cash payments'),
        ('pool_enabled', true, 'Allow pool/shared rides')
      ON CONFLICT (setting_key) DO NOTHING;
    `);



    // Create demo users for testing (Demo Driver removed - only real drivers now)
    await client.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone, user_type, is_verified, rating, total_rides)
      VALUES 
        ('550e8400-e29b-41d4-a716-446655440000', 'demo@rider.com', '$2b$10$8l.TWmIM/oIUu18kSqEgzutqyS8vWuwuT73bMHXxTMV1TYmLfGOaK', 'Admin', 'User', '+1234567890', 'admin', true, 5.0, 0),
        ('550e8400-e29b-41d4-a716-446655440002', 'test@rider.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Avi', 'Selassie', '+1234567892', 'rider', true, 4.8, 47),
        ('550e8400-e29b-41d4-a716-446655440003', 'test@driver.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Test', 'Driver', '+1234567893', 'driver', true, 4.7, 89)
      ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        rating = EXCLUDED.rating,
        total_rides = EXCLUDED.total_rides,
        password_hash = EXCLUDED.password_hash,
        user_type = EXCLUDED.user_type;
    `);

    // Add monthly spending calculation for Avi Selassie
    await client.query(`
      INSERT INTO rides (
        id, rider_id, pickup_address, destination_address, pickup_lat, pickup_lng, 
        destination_lat, destination_lng, ride_type, status, final_fare, completed_at
      ) VALUES 
        ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440000', 'Home', 'Downtown', 36.3729, -94.2088, 36.3818, -94.2087, 'standard', 'completed', 18.50, '2024-01-15 14:30:00'),
        ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440000', 'Office', 'Mall', 36.3650, -94.2100, 36.3818, -94.2087, 'economy', 'completed', 12.75, '2024-01-18 09:15:00'),
        ('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440000', 'Restaurant', 'Home', 36.3818, -94.2087, 36.3729, -94.2088, 'standard', 'completed', 22.30, '2024-01-22 23:45:00'),
        ('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440000', 'Airport', 'Hotel', 36.2818, -94.3068, 36.3729, -94.2088, 'xl', 'completed', 45.80, '2024-01-25 18:20:00')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Add test driver location for the real test driver only (Demo Driver removed)
    await client.query(`
      INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed, is_available)
      VALUES 
        ('550e8400-e29b-41d4-a716-446655440003', 36.3818, -94.2087, 90.0, 0, true)
      ON CONFLICT (driver_id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        heading = EXCLUDED.heading,
        speed = EXCLUDED.speed,
        is_available = EXCLUDED.is_available,
        updated_at = CURRENT_TIMESTAMP;
    `);

    console.log('✅ Database schema initialized successfully');
    console.log('✅ Demo users created/verified');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  } finally {
    if (client) client.release();
  }
}

// Database query helpers
const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),

  // User operations
  async createUser(userData) {
    const { email, password_hash, first_name, last_name, phone, user_type } = userData;
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [email, password_hash, first_name, last_name, phone, user_type]
    );
    return result.rows[0];
  },

  async getUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async getUserById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  async updateUserProfile(id, profileData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Build dynamic update query
    if (profileData.first_name !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(profileData.first_name);
    }
    if (profileData.last_name !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(profileData.last_name);
    }
    if (profileData.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(profileData.email);
    }
    if (profileData.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(profileData.phone);
    }
    if (profileData.date_of_birth !== undefined) {
      fields.push(`date_of_birth = $${paramIndex++}`);
      values.push(profileData.date_of_birth);
    }
    if (profileData.emergency_contact !== undefined) {
      fields.push(`emergency_contact = $${paramIndex++}`);
      values.push(profileData.emergency_contact);
    }
    if (profileData.music_preference !== undefined) {
      fields.push(`music_preference = $${paramIndex++}`);
      values.push(profileData.music_preference);
    }
    if (profileData.conversation_preference !== undefined) {
      fields.push(`conversation_preference = $${paramIndex++}`);
      values.push(profileData.conversation_preference);
    }
    if (profileData.temperature_preference !== undefined) {
      fields.push(`temperature_preference = $${paramIndex++}`);
      values.push(profileData.temperature_preference);
    }
    if (profileData.profile_picture !== undefined) {
      fields.push(`profile_picture = $${paramIndex++}`);
      values.push(profileData.profile_picture);
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_at timestamp
    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    
    // Add user ID for WHERE clause
    values.push(id);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Ride operations
  // Create ride
  async createRide(rideData) {
    try {
      const rideId = uuidv4();
      const query = `
        INSERT INTO rides (
          id, rider_id, pickup_address, pickup_lat, pickup_lng,
          destination_address, destination_lat, destination_lng,
          ride_type, scheduled_time, estimated_fare, payment_method_id,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const estimatedFare = typeof rideData.estimated_fare === 'object' ? 
        rideData.estimated_fare.total : rideData.estimated_fare;

      const values = [
        rideId, rideData.rider_id, rideData.pickup_address,
        rideData.pickup_lat, rideData.pickup_lng,
        rideData.destination_address, rideData.destination_lat, rideData.destination_lng,
        rideData.ride_type, rideData.scheduled_time, estimatedFare,
        rideData.payment_method_id, 'requested', new Date()
      ];

      const result = await this.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Database createRide error:', error);
      // Return a mock ride object for demo purposes
      return {
        id: uuidv4(),
        rider_id: rideData.rider_id,
        pickup_address: rideData.pickup_address,
        pickup_lat: rideData.pickup_lat,
        pickup_lng: rideData.pickup_lng,
        destination_address: rideData.destination_address,
        destination_lat: rideData.destination_lat,
        destination_lng: rideData.destination_lng,
        ride_type: rideData.ride_type,
        status: 'requested',
        created_at: new Date(),
        estimated_fare: typeof rideData.estimated_fare === 'object' ? 
          rideData.estimated_fare.total : rideData.estimated_fare
      };
    }
  },

  async updateRideStatus(rideId, status, additionalData = {}) {
    try {
      const updates = Object.keys(additionalData).map((key, index) => `${key} = $${index + 3}`).join(', ');
      const query = updates 
        ? `UPDATE rides SET status = $1, updated_at = $2, ${updates} WHERE id = $${Object.keys(additionalData).length + 3} RETURNING *`
        : `UPDATE rides SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *`;

      const values = [status, new Date(), ...Object.values(additionalData), rideId];
      const result = await this.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('updateRideStatus error:', error);
      // Return mock data for demo
      return {
        id: rideId,
        status,
        updated_at: new Date(),
        ...additionalData
      };
    }
  },

  async getRidesByUser(userId) {
    const result = await this.query(
      `SELECT * FROM rides WHERE rider_id = $1 OR driver_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  // Driver location operations
  async updateDriverLocation(driverId, locationData) {
    const { latitude, longitude, heading, speed, is_available } = locationData;

    const result = await pool.query(
      `INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed, is_available)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (driver_id) 
       DO UPDATE SET latitude = $2, longitude = $3, heading = $4, speed = $5, 
                     is_available = $6, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [driverId, latitude, longitude, heading, speed, is_available]
    );
    return result.rows[0];
  },

  async getNearbyDrivers(lat, lng, radiusKm = 10) {
    try {
      // Use simpler distance calculation that handles identical coordinates
      const query = `
        SELECT u.id, u.first_name, u.last_name, u.phone, u.rating,
               dl.latitude, dl.longitude, dl.is_available,
               CASE 
                 WHEN dl.latitude = $1 AND dl.longitude = $2 THEN 0
                 ELSE (
                   6371 * 2 * asin(sqrt(
                     power(sin(radians($1 - dl.latitude) / 2), 2) +
                     cos(radians($1)) * cos(radians(dl.latitude)) *
                     power(sin(radians($2 - dl.longitude) / 2), 2)
                   ))
                 )
               END as distance
        FROM users u
        INNER JOIN driver_locations dl ON u.id = dl.driver_id
        WHERE u.user_type = 'driver' 
        AND dl.latitude IS NOT NULL 
        AND dl.longitude IS NOT NULL
        AND dl.is_available = true
        AND (
          CASE 
            WHEN dl.latitude = $1 AND dl.longitude = $2 THEN 0
            ELSE (
              6371 * 2 * asin(sqrt(
                power(sin(radians($1 - dl.latitude) / 2), 2) +
                cos(radians($1)) * cos(radians(dl.latitude)) *
                power(sin(radians($2 - dl.longitude) / 2), 2)
              ))
            )
          END
        ) <= $3
        ORDER BY distance
        LIMIT 10
      `;

      const result = await this.query(query, [lat, lng, radiusKm]);
      return result.rows;
    } catch (error) {
      console.error('getNearbyDrivers error:', error);
      // Return empty array if no database connection
      console.log('⚠️ Database not available - no drivers found');
      return [];
    }
  },

  // Earnings operations
  async recordDriverEarning(earningData) {
    const {
      driver_id, ride_id, base_fare, tip_amount, bonus_amount,
      platform_fee, surge_multiplier, total_earned
    } = earningData;

    const result = await pool.query(
      `INSERT INTO driver_earnings (driver_id, ride_id, base_fare, tip_amount, 
       bonus_amount, platform_fee, surge_multiplier, total_earned) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [driver_id, ride_id, base_fare, tip_amount, bonus_amount, 
       platform_fee, surge_multiplier, total_earned]
    );
    return result.rows[0];
  },

  async getDriverEarnings(driverId, startDate, endDate) {
    const result = await pool.query(`
      SELECT de.*, r.pickup_address, r.destination_address, r.completed_at
      FROM driver_earnings de
      JOIN rides r ON de.ride_id = r.id
      WHERE de.driver_id = $1 
      AND de.earned_at BETWEEN $2 AND $3
      ORDER BY de.earned_at DESC
    `, [driverId, startDate, endDate]);
    return result.rows;
  },

  async getDriverEarningsSummary(driverId, period) {
    let dateFilter = '';
    const now = new Date();

    switch (period) {
      case 'today':
        dateFilter = "AND DATE(de.earned_at) = CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "AND de.earned_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND de.earned_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND de.earned_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    const result = await pool.query(`
      SELECT 
        COUNT(de.id) as total_rides,
        COALESCE(SUM(de.base_fare), 0) as total_base_fare,
        COALESCE(SUM(de.tip_amount), 0) as total_tips,
        COALESCE(SUM(de.bonus_amount), 0) as total_bonuses,
        COALESCE(SUM(de.platform_fee), 0) as total_fees,
        COALESCE(SUM(de.total_earned), 0) as total_earnings,
        COALESCE(AVG(de.total_earned), 0) as avg_per_ride
      FROM driver_earnings de
      WHERE de.driver_id = $1 ${dateFilter}
    `, [driverId]);
    return result.rows[0];
  },

  // Payout operations
  async createPayout(payoutData) {
    const {
      driver_id, amount, fee, net_amount, payout_method_id
    } = payoutData;

    const result = await pool.query(
      `INSERT INTO driver_payouts (driver_id, amount, fee, net_amount, payout_method_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [driver_id, amount, fee, net_amount, payout_method_id]
    );
    return result.rows[0];
  },

  async getDriverPayouts(driverId) {
    const result = await pool.query(`
      SELECT dp.*, dpm.method_type, dpm.account_name, dpm.account_number_masked
      FROM driver_payouts dp
      LEFT JOIN driver_payout_methods dpm ON dp.payout_method_id = dpm.id
      WHERE dp.driver_id = $1
      ORDER BY dp.initiated_at DESC
      LIMIT 50
    `, [driverId]);
    return result.rows;
  },

  async getAvailableBalance(driverId) {
    const earningsResult = await pool.query(`
      SELECT COALESCE(SUM(total_earned), 0) as total_earnings
      FROM driver_earnings
      WHERE driver_id = $1
    `, [driverId]);

    const payoutsResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_payouts
      FROM driver_payouts
      WHERE driver_id = $1 AND status = 'completed'
    `, [driverId]);

    const totalEarnings = parseFloat(earningsResult.rows[0].total_earnings);
    const totalPayouts = parseFloat(payoutsResult.rows[0].total_payouts);

    return {
      totalEarnings,
      totalPayouts,
      availableBalance: totalEarnings - totalPayouts
    };
  },

  // Payout methods operations
  async addPayoutMethod(methodData) {
    const {
      driver_id, method_type, account_name, account_number_masked,
      routing_number_masked, external_account_id
    } = methodData;

    const result = await pool.query(
      `INSERT INTO driver_payout_methods (driver_id, method_type, account_name, 
       account_number_masked, routing_number_masked, external_account_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [driver_id, method_type, account_name, account_number_masked, 
       routing_number_masked, external_account_id]
    );
    return result.rows[0];
  },

  async getDriverPayoutMethods(driverId) {
    const result = await pool.query(
      'SELECT * FROM driver_payout_methods WHERE driver_id = $1 ORDER BY is_default DESC, created_at DESC',
      [driverId]
    );
    return result.rows;
  },

  // Payment method operations
  async addPaymentMethod(userId, paymentMethodData) {
    const {
      stripe_pm_id, type, brand, last4, exp_month, exp_year, is_default
    } = paymentMethodData;

    const result = await pool.query(
      `INSERT INTO payment_methods (user_id, stripe_pm_id, type, brand, last4, exp_month, exp_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId, stripe_pm_id, type, brand, last4, exp_month, exp_year, is_default]
    );
    return result.rows[0];
  },

  async getPaymentMethods(userId) {
    const result = await pool.query(
      'SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [userId]
    );
    return result.rows;
  },

  async deletePaymentMethod(userId, stripePaymentMethodId) {
    const result = await pool.query(
      'DELETE FROM payment_methods WHERE user_id = $1 AND stripe_pm_id = $2 RETURNING *',
      [userId, stripePaymentMethodId]
    );
    return result.rows[0];
  },

  async setDefaultPaymentMethod(userId, stripePaymentMethodId) {
    // First, set all methods to non-default
    await pool.query(
      'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
      [userId]
    );

    // Then set the selected one as default
    const result = await pool.query(
      'UPDATE payment_methods SET is_default = true WHERE user_id = $1 AND stripe_pm_id = $2 RETURNING *',
      [userId, stripePaymentMethodId]
    );
    return result.rows[0];
  },

  // Corporate Discount System Operations
  
  // Corporation Management
  async createCorporation(corporationData) {
    const {
      company_name, company_email, contact_person, contact_phone,
      discount_type, discount_value, valid_days, start_date, end_date,
      max_discount_amount, min_ride_amount, created_by
    } = corporationData;

    const result = await pool.query(
      `INSERT INTO corporations (
        company_name, company_email, contact_person, contact_phone,
        discount_type, discount_value, valid_days, start_date, end_date,
        max_discount_amount, min_ride_amount, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [company_name, company_email, contact_person, contact_phone,
       discount_type, discount_value, JSON.stringify(valid_days), start_date, end_date,
       max_discount_amount, min_ride_amount, created_by]
    );
    return result.rows[0];
  },

  async getAllCorporations() {
    const result = await pool.query(
      'SELECT * FROM corporations ORDER BY created_at DESC'
    );
    return result.rows;
  },

  async getCorporationById(corporationId) {
    const result = await pool.query(
      'SELECT * FROM corporations WHERE id = $1',
      [corporationId]
    );
    return result.rows[0];
  },

  async updateCorporation(corporationId, updateData) {
    const {
      company_name, company_email, contact_person, contact_phone,
      discount_type, discount_value, valid_days, start_date, end_date,
      max_discount_amount, min_ride_amount, is_active
    } = updateData;

    const result = await pool.query(
      `UPDATE corporations SET
        company_name = COALESCE($1, company_name),
        company_email = COALESCE($2, company_email),
        contact_person = COALESCE($3, contact_person),
        contact_phone = COALESCE($4, contact_phone),
        discount_type = COALESCE($5, discount_type),
        discount_value = COALESCE($6, discount_value),
        valid_days = COALESCE($7, valid_days),
        start_date = COALESCE($8, start_date),
        end_date = COALESCE($9, end_date),
        max_discount_amount = COALESCE($10, max_discount_amount),
        min_ride_amount = COALESCE($11, min_ride_amount),
        is_active = COALESCE($12, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 RETURNING *`,
      [company_name, company_email, contact_person, contact_phone,
       discount_type, discount_value, valid_days ? JSON.stringify(valid_days) : null,
       start_date, end_date, max_discount_amount, min_ride_amount, is_active, corporationId]
    );
    return result.rows[0];
  },

  async deleteCorporation(corporationId) {
    const result = await pool.query(
      'DELETE FROM corporations WHERE id = $1 RETURNING *',
      [corporationId]
    );
    return result.rows[0];
  },

  // Corporate Applications Management
  async createCorporateApplication(applicationData) {
    const {
      rider_id, corporation_id, work_email, employee_id, 
      department, work_id_image_url
    } = applicationData;

    const result = await pool.query(
      `INSERT INTO corporate_applications (
        rider_id, corporation_id, work_email, employee_id, 
        department, work_id_image_url
      ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [rider_id, corporation_id, work_email, employee_id, department, work_id_image_url]
    );
    return result.rows[0];
  },

  async getAllCorporateApplications() {
    const result = await pool.query(`
      SELECT ca.*, 
             u.first_name, u.last_name, u.email as rider_email,
             c.company_name, c.discount_type, c.discount_value
      FROM corporate_applications ca
      JOIN users u ON ca.rider_id = u.id
      JOIN corporations c ON ca.corporation_id = c.id
      ORDER BY ca.created_at DESC
    `);
    return result.rows;
  },

  async getCorporateApplicationById(applicationId) {
    const result = await pool.query(`
      SELECT ca.*, 
             u.first_name, u.last_name, u.email as rider_email,
             c.company_name, c.discount_type, c.discount_value
      FROM corporate_applications ca
      JOIN users u ON ca.rider_id = u.id
      JOIN corporations c ON ca.corporation_id = c.id
      WHERE ca.id = $1
    `, [applicationId]);
    return result.rows[0];
  },

  async reviewCorporateApplication(applicationId, reviewData) {
    const { status, reviewed_by, review_notes, rejection_reason } = reviewData;
    
    const result = await pool.query(`
      UPDATE corporate_applications SET
        status = $1,
        reviewed_by = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        review_notes = $3,
        rejection_reason = $4,
        approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
        discount_start_date = CASE WHEN $1 = 'approved' THEN CURRENT_DATE ELSE discount_start_date END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 RETURNING *
    `, [status, reviewed_by, review_notes, rejection_reason, applicationId]);

    // If approved, update user's active corporate discount
    if (status === 'approved' && result.rows[0]) {
      await pool.query(
        'UPDATE users SET active_corporate_discount = $1 WHERE id = $2',
        [applicationId, result.rows[0].rider_id]
      );
    }

    return result.rows[0];
  },

  // Corporate Discount Usage Tracking
  async recordCorporateDiscountUsage(usageData) {
    const {
      ride_id, corporate_application_id, corporation_id,
      original_fare, discount_amount, final_fare, ride_day_of_week
    } = usageData;

    const result = await pool.query(
      `INSERT INTO corporate_discount_usage (
        ride_id, corporate_application_id, corporation_id,
        original_fare, discount_amount, final_fare, ride_day_of_week
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [ride_id, corporate_application_id, corporation_id,
       original_fare, discount_amount, final_fare, ride_day_of_week]
    );
    return result.rows[0];
  },

  async getCorporateDiscountAnalytics() {
    const result = await pool.query(`
      SELECT 
        c.company_name,
        COUNT(cdu.id) as total_usage_count,
        SUM(cdu.discount_amount) as total_savings,
        AVG(cdu.discount_amount) as avg_discount_per_ride,
        COUNT(DISTINCT cdu.corporate_application_id) as active_employees
      FROM corporate_discount_usage cdu
      JOIN corporations c ON cdu.corporation_id = c.id
      GROUP BY c.id, c.company_name
      ORDER BY total_savings DESC
    `);
    return result.rows;
  }
};

module.exports = { pool, db, initializeDatabase };