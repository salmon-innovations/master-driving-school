-- CRM (Customer Relationship Management) System Migration
-- This migration adds tables for managing leads, interactions, and customer relationships

-- Create lead_sources table (referral, social media, website, walk-in, etc.)
CREATE TABLE IF NOT EXISTS lead_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create lead_statuses table (new, contacted, qualified, converted, lost, etc.)
CREATE TABLE IF NOT EXISTS lead_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6B7280', -- hex color for UI display
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    
    -- Lead information
    lead_source_id INTEGER REFERENCES lead_sources(id),
    lead_status_id INTEGER REFERENCES lead_statuses(id),
    assigned_to INTEGER REFERENCES users(id), -- staff/admin assigned to this lead
    interest_course_id INTEGER REFERENCES courses(id), -- what course they're interested in
    interest_branch_id INTEGER REFERENCES branches(id), -- preferred branch
    
    -- Scoring and priority
    lead_score INTEGER DEFAULT 0, -- 0-100 scoring system
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    
    -- Conversion tracking
    is_converted BOOLEAN DEFAULT false,
    converted_to_user_id INTEGER REFERENCES users(id), -- if converted to actual student
    converted_at TIMESTAMP,
    
    -- Additional info
    notes TEXT,
    tags VARCHAR(255)[], -- Array of tags for categorization
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contacted_at TIMESTAMP,
    
    CONSTRAINT priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- Create interactions table (calls, emails, meetings, etc.)
CREATE TABLE IF NOT EXISTS lead_interactions (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id), -- staff who made the interaction
    
    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL, -- call, email, meeting, whatsapp, sms, visit, etc.
    subject VARCHAR(255),
    notes TEXT,
    outcome VARCHAR(100), -- interested, not_interested, callback_later, converted, etc.
    
    -- Scheduling
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Follow-up
    requires_followup BOOLEAN DEFAULT false,
    followup_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT interaction_type_check CHECK (interaction_type IN (
        'call', 'email', 'meeting', 'whatsapp', 'sms', 'visit', 'other'
    ))
);

-- Create lead_attachments table (for storing documents, images, etc.)
CREATE TABLE IF NOT EXISTS lead_attachments (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id), -- who uploaded it
    
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER, -- in bytes
    file_url TEXT, -- if stored externally
    file_data BYTEA, -- if stored in database
    
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default lead sources
INSERT INTO lead_sources (name, description) VALUES
    ('Website', 'Inquiries from the website'),
    ('Social Media', 'Facebook, Instagram, etc.'),
    ('Walk-in', 'Walked into branch'),
    ('Referral', 'Referred by existing student'),
    ('Phone Call', 'Direct phone inquiry'),
    ('Email', 'Email inquiry'),
    ('Advertisement', 'Saw our advertisement'),
    ('Other', 'Other sources')
ON CONFLICT (name) DO NOTHING;

-- Insert default lead statuses
INSERT INTO lead_statuses (name, description, color, sort_order) VALUES
    ('New', 'Newly created lead', '#3B82F6', 1),
    ('Contacted', 'Initial contact made', '#8B5CF6', 2),
    ('Qualified', 'Qualified as potential student', '#10B981', 3),
    ('Proposal Sent', 'Course proposal sent', '#F59E0B', 4),
    ('Negotiation', 'In price/terms negotiation', '#EF4444', 5),
    ('Converted', 'Successfully enrolled', '#22C55E', 6),
    ('Lost', 'Opportunity lost', '#6B7280', 7),
    ('Not Interested', 'Not interested at this time', '#9CA3AF', 8)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_converted ON leads(is_converted);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead ON lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_user ON lead_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_type ON lead_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_lead_attachments_lead ON lead_attachments(lead_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to leads table
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to lead_interactions table
DROP TRIGGER IF EXISTS update_lead_interactions_updated_at ON lead_interactions;
CREATE TRIGGER update_lead_interactions_updated_at
    BEFORE UPDATE ON lead_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE leads IS 'CRM leads/prospects table';
COMMENT ON TABLE lead_interactions IS 'Record of all interactions with leads';
COMMENT ON TABLE lead_sources IS 'Sources where leads come from';
COMMENT ON TABLE lead_statuses IS 'Status progression of leads';
COMMENT ON TABLE lead_attachments IS 'Files and documents attached to leads';
