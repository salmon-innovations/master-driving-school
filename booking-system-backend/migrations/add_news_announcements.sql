-- Migration: Unified News & Events
-- Created: 2026-02-18

DROP TABLE IF EXISTS news_events CASCADE;

CREATE TABLE news_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    tag VARCHAR(50), 
    type VARCHAR(50) DEFAULT 'News & Event', 
    media_url TEXT, 
    duration VARCHAR(20), 
    thumbnail_url TEXT, 
    interactions VARCHAR(50) DEFAULT '0 views',
    views_count INTEGER DEFAULT 0,
    author_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'published',
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);