-- GMessage Database Schema
-- Production-ready with indexes and constraints

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(64),
    last_name VARCHAR(64),
    bio TEXT,
    avatar_url TEXT,
    phone VARCHAR(20) UNIQUE,
    phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    two_factor_secret VARCHAR(64),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away', 'dnd')),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'custom')),
    custom_theme JSONB,
    reputation_score INTEGER DEFAULT 0,
    reputation_level VARCHAR(32) DEFAULT 'Новичок',
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires TIMESTAMPTZ,
    is_admin BOOLEAN DEFAULT FALSE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    notification_settings JSONB DEFAULT '{"messages": true, "calls": true, "mentions": true}',
    privacy_settings JSONB DEFAULT '{"last_seen": "everyone", "avatar": "everyone", "status": "everyone"}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users USING gin(username gin_trgm_ops);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_reputation ON users(reputation_score DESC);

-- ============================================================
-- SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(512) UNIQUE NOT NULL,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);

-- ============================================================
-- CHATS TABLE (personal + group)
-- ============================================================
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('personal', 'group', 'channel')),
    name VARCHAR(128),
    description TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES users(id),
    invite_link VARCHAR(64) UNIQUE,
    is_public BOOLEAN DEFAULT FALSE,
    max_members INTEGER DEFAULT 200,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chats_type ON chats(type);
CREATE INDEX idx_chats_invite ON chats(invite_link);

-- ============================================================
-- CHAT MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
    nickname VARCHAR(64),
    muted_until TIMESTAMPTZ,
    is_banned BOOLEAN DEFAULT FALSE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    last_read_message_id UUID,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_chat_members_chat ON chat_members(chat_id);
CREATE INDEX idx_chat_members_user ON chat_members(user_id);

-- ============================================================
-- MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'voice', 'video', 'system', 'call')),
    content TEXT,
    file_url TEXT,
    file_name VARCHAR(255),
    file_size INTEGER,
    file_mime_type VARCHAR(100),
    duration INTEGER, -- for voice/video in seconds
    thumbnail_url TEXT,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_chat ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply ON messages(reply_to_id);
CREATE INDEX idx_messages_content ON messages USING gin(to_tsvector('russian', coalesce(content, '')));

-- ============================================================
-- MESSAGE REACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);

-- ============================================================
-- MESSAGE READ STATUS
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reads (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_reads_message ON message_reads(message_id);
CREATE INDEX idx_reads_user ON message_reads(user_id);

-- ============================================================
-- CONTACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(64),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, contact_id)
);

CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_contacts_contact ON contacts(contact_id);

-- ============================================================
-- CHANNELS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE UNIQUE,
    username VARCHAR(32) UNIQUE,
    subscriber_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    category VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channels_username ON channels USING gin(username gin_trgm_ops);

-- ============================================================
-- CALLS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES users(id),
    chat_id UUID REFERENCES chats(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('voice', 'video', 'group_voice', 'group_video')),
    status VARCHAR(20) DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'declined', 'failed')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration INTEGER, -- seconds
    end_reason VARCHAR(50),
    recording_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calls_caller ON calls(caller_id);
CREATE INDEX idx_calls_chat ON calls(chat_id);
CREATE INDEX idx_calls_status ON calls(status);

-- ============================================================
-- CALL PARTICIPANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS call_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    is_video_on BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    UNIQUE(call_id, user_id)
);

-- ============================================================
-- REPUTATION EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reputation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reputation_user ON reputation_events(user_id, created_at DESC);

-- ============================================================
-- REPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    reported_message_id UUID REFERENCES messages(id),
    type VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status, created_at DESC);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action, created_at DESC);

-- ============================================================
-- FUNCTION: Auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: Update reputation level based on score
-- ============================================================
CREATE OR REPLACE FUNCTION update_reputation_level()
RETURNS TRIGGER AS $$
BEGIN
    NEW.reputation_level = CASE
        WHEN NEW.reputation_score < 0 THEN 'Нарушитель'
        WHEN NEW.reputation_score < 50 THEN 'Новичок'
        WHEN NEW.reputation_score < 200 THEN 'Активный'
        WHEN NEW.reputation_score < 500 THEN 'Надёжный'
        WHEN NEW.reputation_score < 1000 THEN 'Опытный'
        WHEN NEW.reputation_score < 5000 THEN 'Эксперт'
        ELSE 'Легенда'
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_reputation_level BEFORE UPDATE OF reputation_score ON users
    FOR EACH ROW EXECUTE FUNCTION update_reputation_level();
