/* Auto-generated types from JSON Schema */

/**
 * Standardized envelope for all domain events
 */
export interface EventEnvelopeV1 {
  /**
   * Unique identifier for this event
   */
  event_id: string;
  /**
   * Type of event (e.g., UserCreated, UserUpdated)
   */
  event_type: string;
  /**
   * Redis stream topic (e.g., identity.user.v1)
   */
  topic: string;
  /**
   * Schema version for compatibility
   */
  schema_version: number;
  /**
   * ISO 8601 timestamp when event occurred
   */
  occurred_at: string;
  /**
   * Tenant identifier for multi-tenancy
   */
  tenant_id: string;
  /**
   * ID of the aggregate that generated this event
   */
  aggregate_id: string;
  /**
   * Type of aggregate (e.g., user, document)
   */
  aggregate_type?: string;
  /**
   * Optional correlation ID for request tracing
   */
  correlation_id?: string | null;
  /**
   * Event-specific payload data
   */
  payload: {
    [k: string]: unknown;
  };
}
