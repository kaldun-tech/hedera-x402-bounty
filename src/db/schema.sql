-- HCS Message Archive Schema

CREATE TABLE IF NOT EXISTS topics (
    topic_id TEXT PRIMARY KEY,
    memo TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    message_count BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES topics(topic_id),
    sequence_number BIGINT NOT NULL,
    consensus_timestamp TIMESTAMPTZ NOT NULL,
    message BYTEA NOT NULL,
    payer_account_id TEXT,
    running_hash BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(topic_id, sequence_number)
);

-- Index for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_messages_topic_timestamp
    ON messages(topic_id, consensus_timestamp DESC);

-- Index for sequence number lookups
CREATE INDEX IF NOT EXISTS idx_messages_topic_sequence
    ON messages(topic_id, sequence_number);
