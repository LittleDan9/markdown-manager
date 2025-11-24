-- Event ledger database migration for idempotency tracking.
--
-- This migration adds event_ledger tables to each service schema to track
-- processed events and ensure idempotent message handling.

-- Create event_ledger table for identity service
CREATE TABLE IF NOT EXISTS identity.event_ledger (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    consumer_group VARCHAR(100) NOT NULL,
    processing_result VARCHAR(50) DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT event_ledger_result_check
        CHECK (processing_result IN ('success', 'failure', 'skipped'))
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_event_ledger_type_processed
    ON identity.event_ledger (event_type, processed_at);
CREATE INDEX IF NOT EXISTS idx_event_ledger_consumer_group
    ON identity.event_ledger (consumer_group, processed_at);

-- Create event_ledger table for markdown-lint consumer
CREATE TABLE IF NOT EXISTS public.event_ledger (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    consumer_group VARCHAR(100) NOT NULL,
    processing_result VARCHAR(50) DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT event_ledger_result_check
        CHECK (processing_result IN ('success', 'failure', 'skipped'))
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_event_ledger_type_processed
    ON public.event_ledger (event_type, processed_at);
CREATE INDEX IF NOT EXISTS idx_event_ledger_consumer_group
    ON public.event_ledger (consumer_group, processed_at);

-- Create cleanup function to remove old ledger entries (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_event_ledger() RETURNS void AS $$
BEGIN
    DELETE FROM identity.event_ledger
    WHERE processed_at < NOW() - INTERVAL '30 days';

    DELETE FROM public.event_ledger
    WHERE processed_at < NOW() - INTERVAL '30 days';

    RAISE NOTICE 'Event ledger cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON identity.event_ledger TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_ledger TO postgres;