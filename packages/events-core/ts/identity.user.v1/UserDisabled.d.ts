/* Auto-generated types from JSON Schema */

/**
 * Event emitted when a user account is disabled
 */
export interface UserDisabledEvent {
  /**
   * Unique identifier for the user
   */
  user_id: string;
  /**
   * Tenant identifier
   */
  tenant_id: string;
  /**
   * User's email address
   */
  email: string;
  /**
   * User's display name
   */
  display_name?: string | null;
  /**
   * When the user was disabled
   */
  disabled_at: string;
  /**
   * ID of user/admin who disabled this account
   */
  disabled_by: string;
  /**
   * Reason for account disabling
   */
  reason: "admin_action" | "self_deletion" | "security_violation" | "policy_violation";
}
