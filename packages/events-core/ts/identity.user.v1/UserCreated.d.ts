/* Auto-generated types from JSON Schema */

/**
 * Event emitted when a new user is created
 */
export interface UserCreatedEvent {
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
  display_name: string | null;
  /**
   * User's first name
   */
  first_name?: string | null;
  /**
   * User's last name
   */
  last_name?: string | null;
  /**
   * User account status
   */
  status: "active" | "disabled";
  /**
   * Whether user email is verified
   */
  is_verified?: boolean;
  /**
   * Whether user has admin privileges
   */
  is_admin?: boolean;
  /**
   * Whether MFA is enabled for user
   */
  mfa_enabled?: boolean;
  /**
   * When the user was created
   */
  created_at: string;
}
