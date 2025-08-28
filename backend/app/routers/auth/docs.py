"""
OpenAPI documentation for Authentication API endpoints.
Externalized documentation to keep router files manageable.
"""

# Common responses for all auth endpoints
COMMON_RESPONSES = {
    400: {"description": "Bad request"},
    401: {"description": "Authentication required"},
    422: {"description": "Validation error"},
    500: {"description": "Internal server error"}
}

# Authentication Endpoints Documentation
AUTH_LOGIN_DOCS = {
    "login": {
        "summary": "User login",
        "description": """
        Authenticate user with email and password. Returns access token or requires MFA.

        **Authentication Flow:**
        1. **Standard Login**: Returns access token immediately if MFA is disabled
        2. **MFA Required**: Returns `mfa_required: true` if MFA is enabled

        **Token Management:**
        - Access token expires in 30 minutes (configurable)
        - Refresh token set as secure HTTP-only cookie (14 days)
        - Automatic GitHub repository sync triggered on successful login

        **Security Features:**
        - Secure password verification
        - Account status validation
        - Automatic cookie management
        - Background GitHub sync

        **Example Request:**
        ```json
        {
            "email": "user@example.com",
            "password": "securePassword123"
        }
        ```
        """,
        "responses": {
            200: {
                "description": "Login successful or MFA required",
                "content": {
                    "application/json": {
                        "examples": {
                            "standard_login": {
                                "summary": "Standard login (no MFA)",
                                "value": {
                                    "mfa_required": False,
                                    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                    "token_type": "bearer",
                                    "user": {
                                        "id": 1,
                                        "email": "user@example.com",
                                        "is_active": True,
                                        "mfa_enabled": False,
                                        "current_doc_id": None
                                    }
                                }
                            },
                            "mfa_required": {
                                "summary": "MFA required",
                                "value": {
                                    "mfa_required": True
                                }
                            }
                        }
                    }
                }
            },
            401: {"description": "Invalid credentials or inactive user"}
        }
    },
    "refresh": {
        "summary": "Refresh access token",
        "description": """
        Refresh access token using valid refresh token from HTTP-only cookie.

        **Token Rotation:**
        - Issues new access token (30 minutes)
        - Issues new refresh token (sliding window, 14 days)
        - Updates HTTP-only cookie automatically

        **Background Operations:**
        - Triggers GitHub repository sync (respects 1-hour rate limit)
        - Validates user account status

        **Security:**
        - Refresh token validated and rotated
        - Secure cookie management
        - User status verification
        """,
        "responses": {
            200: {
                "description": "Token refreshed successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                            "token_type": "bearer",
                            "user": {
                                "id": 1,
                                "email": "user@example.com",
                                "is_active": True,
                                "mfa_enabled": False,
                                "current_doc_id": 5
                            }
                        }
                    }
                }
            },
            401: {"description": "Invalid or expired refresh token"}
        }
    },
    "login_mfa": {
        "summary": "Complete MFA login",
        "description": """
        Complete login process with Multi-Factor Authentication code.

        **MFA Support:**
        - TOTP codes from authenticator apps (Google Authenticator, Authy, etc.)
        - Backup codes (one-time use emergency codes)

        **Security Process:**
        1. Re-verify password for security
        2. Validate TOTP or backup code
        3. Issue access and refresh tokens
        4. Consume backup code if used

        **Backup Code Handling:**
        - Backup codes are single-use
        - Used codes are automatically removed
        - User should regenerate codes when running low
        """,
        "responses": {
            200: {
                "description": "MFA login successful",
                "content": {
                    "application/json": {
                        "example": {
                            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                            "token_type": "bearer",
                            "user": {
                                "id": 1,
                                "email": "user@example.com",
                                "is_active": True,
                                "mfa_enabled": True,
                                "current_doc_id": None
                            }
                        }
                    }
                }
            },
            401: {"description": "Invalid credentials or TOTP/backup code"}
        }
    },
    "logout": {
        "summary": "User logout",
        "description": """
        Log out user by clearing refresh token cookie.

        **Logout Process:**
        - Removes refresh token cookie
        - Client should discard access token
        - Session effectively terminated

        **Note:** Access tokens remain valid until expiration (30 minutes).
        For immediate revocation, implement token blacklisting.
        """,
        "responses": {
            200: {
                "description": "Successfully logged out",
                "content": {
                    "application/json": {
                        "example": {"message": "Logged out"}
                    }
                }
            }
        }
    }
}

# Registration Documentation
AUTH_REGISTRATION_DOCS = {
    "register": {
        "summary": "Register new user",
        "description": """
        Create a new user account with automatic setup.

        **Registration Process:**
        1. Validate email uniqueness
        2. Create user account with hashed password
        3. Create default categories ("General", "Drafts")
        4. Return user information

        **Default Setup:**
        - Creates "General" and "Drafts" categories
        - User starts with no documents
        - MFA disabled by default
        - Account activated immediately

        **Email Validation:**
        - Email must be unique across all users
        - Email format validation applied
        - Case-insensitive email comparison

        **Password Requirements:**
        - Minimum length enforced by validation
        - Secure hashing with bcrypt
        - Passwords not returned in responses
        """,
        "responses": {
            200: {
                "description": "User registered successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "id": 42,
                            "email": "newuser@example.com",
                            "is_active": True,
                            "mfa_enabled": False,
                            "current_doc_id": None,
                            "created_at": "2025-08-28T12:00:00Z",
                            "updated_at": "2025-08-28T12:00:00Z"
                        }
                    }
                }
            },
            400: {"description": "Email already registered"}
        }
    }
}

# Profile Management Documentation
AUTH_PROFILE_DOCS = {
    "get_current_user": {
        "summary": "Get current user profile",
        "description": """
        Retrieve profile information for the authenticated user.

        **Returned Information:**
        - User ID and email
        - Account status (active/inactive)
        - MFA enablement status
        - Current document ID (if any)
        - Account creation and update timestamps

        **Authentication Required:**
        Must provide valid access token in Authorization header.

        **Use Cases:**
        - Profile page display
        - User status verification
        - Current session validation
        - Navigation state restoration
        """,
        "responses": {
            200: {
                "description": "User profile retrieved successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "id": 1,
                            "email": "user@example.com",
                            "is_active": True,
                            "mfa_enabled": True,
                            "current_doc_id": 5,
                            "created_at": "2025-07-15T09:30:00Z",
                            "updated_at": "2025-08-28T11:45:00Z"
                        }
                    }
                }
            },
            401: {"description": "Invalid or expired access token"}
        }
    }
}

# Password Reset Documentation
AUTH_PASSWORD_RESET_DOCS = {
    "request_reset": {
        "summary": "Request password reset",
        "description": """
        Initiate password reset process by sending reset link via email.

        **Reset Process:**
        1. Validate email exists in system
        2. Generate secure reset token (1-hour expiration)
        3. Send email with reset link
        4. Return success message (regardless of email existence)

        **Security Features:**
        - Tokens expire in 1 hour
        - Cryptographically secure token generation
        - No information disclosure about email existence
        - SMTP configuration from environment

        **Email Configuration:**
        - SMTP settings configurable via environment variables
        - Support for TLS/SSL email sending
        - Graceful fallback if email fails

        **Development Mode:**
        - Set `DEBUG_PASSWORD_RESET_TOKEN=true` to include token in response
        - Only for development/testing environments
        """,
        "responses": {
            200: {
                "description": "Reset email sent (or would be sent)",
                "content": {
                    "application/json": {
                        "examples": {
                            "production": {
                                "summary": "Production response",
                                "value": {
                                    "message": "If the email exists, a reset link has been sent"
                                }
                            },
                            "development": {
                                "summary": "Development response (with debug token)",
                                "value": {
                                    "message": "If the email exists, a reset link has been sent",
                                    "debug_token": "abc123def456ghi789xyz"
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    "confirm_reset": {
        "summary": "Confirm password reset",
        "description": """
        Complete password reset using valid reset token.

        **Reset Validation:**
        - Token must be valid and not expired
        - Token is single-use (consumed on success)
        - New password must meet security requirements

        **Security Process:**
        1. Validate reset token
        2. Check token expiration (1 hour)
        3. Hash new password securely
        4. Update user password
        5. Invalidate reset token

        **Post-Reset:**
        - User must log in with new password
        - All existing sessions remain valid
        - Consider forcing re-authentication for security
        """,
        "responses": {
            200: {
                "description": "Password reset successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "message": "Password has been reset successfully"
                        }
                    }
                }
            },
            400: {"description": "Invalid or expired reset token"}
        }
    }
}

# MFA (Multi-Factor Authentication) Documentation
AUTH_MFA_DOCS = {
    "setup": {
        "summary": "Initialize MFA setup",
        "description": """
        Begin MFA setup process by generating TOTP secret and backup codes.

        **Setup Process:**
        1. Generate cryptographically secure TOTP secret
        2. Create 10 backup codes for emergency access
        3. Generate QR code for authenticator app setup
        4. Store setup data (MFA not enabled yet)

        **QR Code Generation:**
        - Compatible with Google Authenticator, Authy, 1Password, etc.
        - Includes user email and service name
        - Base64-encoded PNG data URL

        **Backup Codes:**
        - 10 single-use emergency codes
        - Alphanumeric format for easy entry
        - Encrypted storage in database

        **Security Note:**
        MFA is not enabled until verification is completed.
        """,
        "responses": {
            200: {
                "description": "MFA setup initialized",
                "content": {
                    "application/json": {
                        "example": {
                            "qr_code_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEU...",
                            "secret": "JBSWY3DPEHPK3PXP",
                            "backup_codes": [
                                "12345678", "23456789", "34567890",
                                "45678901", "56789012", "67890123",
                                "78901234", "89012345", "90123456", "01234567"
                            ]
                        }
                    }
                }
            },
            500: {"description": "Failed to setup MFA"}
        }
    },
    "verify": {
        "summary": "Verify MFA setup",
        "description": """
        Verify TOTP code during MFA setup process.

        **Verification Process:**
        - Validates TOTP code from authenticator app
        - Confirms user can generate valid codes
        - Does not enable MFA yet (use /enable endpoint)

        **Code Validation:**
        - 6-digit TOTP codes
        - 30-second time window tolerance
        - Prevents replay attacks
        """,
        "responses": {
            200: {
                "description": "TOTP code verified successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "success": True,
                            "message": "TOTP code verified successfully"
                        }
                    }
                }
            },
            400: {"description": "Invalid TOTP code or MFA not set up"}
        }
    },
    "enable": {
        "summary": "Enable MFA",
        "description": """
        Enable Multi-Factor Authentication for the user account.

        **Enabling Requirements:**
        1. Current password verification
        2. Valid TOTP code from authenticator app
        3. MFA setup must be completed first

        **Security Process:**
        - Re-verify current password for security
        - Validate TOTP code to confirm app setup
        - Enable MFA permanently for account
        - All future logins require MFA

        **Post-Enablement:**
        - User must use TOTP codes for login
        - Backup codes available for emergencies
        - Can disable MFA with current password + TOTP
        """,
        "responses": {
            200: {
                "description": "MFA enabled successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "success": True,
                            "message": "MFA enabled successfully"
                        }
                    }
                }
            },
            400: {"description": "Invalid password, TOTP code, or MFA not set up"}
        }
    },
    "disable": {
        "summary": "Disable MFA",
        "description": """
        Disable Multi-Factor Authentication for the user account.

        **Disabling Requirements:**
        1. Current password verification
        2. Valid TOTP code OR valid backup code

        **Security Process:**
        - Re-verify current password for security
        - Accept TOTP code from authenticator app
        - Accept backup code as alternative
        - Remove MFA requirement from account

        **Backup Code Usage:**
        - Backup codes are consumed when used
        - Remaining codes still valid after MFA disable
        - Consider regenerating codes for security
        """,
        "responses": {
            200: {
                "description": "MFA disabled successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "message": "MFA disabled successfully"
                        }
                    }
                }
            },
            400: {"description": "Invalid password, TOTP/backup code, or MFA not enabled"}
        }
    },
    "get_backup_codes": {
        "summary": "Get remaining backup codes",
        "description": """
        Retrieve list of remaining (unused) backup codes.

        **Backup Code Management:**
        - Shows only unused codes
        - Used codes are automatically removed
        - Codes are single-use only

        **Security Considerations:**
        - Store backup codes securely
        - Regenerate when running low
        - Each code works only once

        **Use Cases:**
        - User wants to see remaining codes
        - Emergency access planning
        - Backup code inventory
        """,
        "responses": {
            200: {
                "description": "Backup codes retrieved successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "backup_codes": [
                                "12345678", "23456789", "34567890",
                                "45678901", "56789012", "67890123",
                                "78901234"
                            ]
                        }
                    }
                }
            },
            400: {"description": "MFA is not enabled"}
        }
    },
    "regenerate_backup_codes": {
        "summary": "Regenerate backup codes",
        "description": """
        Generate new set of backup codes, replacing all existing ones.

        **Regeneration Process:**
        1. Verify TOTP code for security
        2. Generate 10 new backup codes
        3. Replace all existing codes
        4. Return new codes to user

        **Security Warning:**
        - All existing backup codes become invalid
        - User must store new codes securely
        - Previous codes cannot be recovered

        **Use Cases:**
        - Running low on backup codes
        - Security concern about code compromise
        - Regular security maintenance
        """,
        "responses": {
            200: {
                "description": "Backup codes regenerated successfully",
                "content": {
                    "application/json": {
                        "example": {
                            "backup_codes": [
                                "98765432", "87654321", "76543210",
                                "65432109", "54321098", "43210987",
                                "32109876", "21098765", "10987654", "09876543"
                            ]
                        }
                    }
                }
            },
            400: {"description": "Invalid TOTP code or MFA not enabled"}
        }
    }
}

# Request/Response Schema Documentation
AUTH_SCHEMA_EXAMPLES = {
    "UserLogin": {
        "example": {
            "email": "user@example.com",
            "password": "securePassword123"
        },
        "description": "Login credentials"
    },
    "LoginMFARequest": {
        "example": {
            "email": "user@example.com",
            "password": "securePassword123",
            "code": "123456"
        },
        "description": "MFA login with TOTP or backup code"
    },
    "UserCreate": {
        "example": {
            "email": "newuser@example.com",
            "password": "securePassword123"
        },
        "description": "User registration data"
    },
    "PasswordResetRequest": {
        "example": {
            "email": "user@example.com"
        },
        "description": "Password reset request"
    },
    "PasswordResetConfirm": {
        "example": {
            "token": "abc123def456ghi789xyz",
            "new_password": "newSecurePassword456"
        },
        "description": "Password reset confirmation"
    },
    "MFAToggleRequest": {
        "example": {
            "current_password": "currentPassword123",
            "totp_code": "123456"
        },
        "description": "MFA enable/disable request"
    },
    "MFAVerifyRequest": {
        "example": {
            "totp_code": "123456"
        },
        "description": "TOTP code verification"
    }
}

# Error Response Examples
AUTH_ERROR_EXAMPLES = {
    "InvalidCredentials": {
        "example": {
            "detail": "Incorrect email or password"
        }
    },
    "EmailAlreadyExists": {
        "example": {
            "detail": "Email already registered"
        }
    },
    "InvalidMFACode": {
        "example": {
            "detail": "Invalid TOTP code or backup code"
        }
    },
    "MFANotEnabled": {
        "example": {
            "detail": "MFA is not enabled"
        }
    },
    "InvalidResetToken": {
        "example": {
            "detail": "Invalid or expired reset token"
        }
    },
    "MFASetupIncomplete": {
        "example": {
            "detail": "MFA setup not completed"
        }
    }
}
