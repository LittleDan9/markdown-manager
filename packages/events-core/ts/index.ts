// Export generated types
export * from './envelope.v1';
export * from './identity.user.v1/UserCreated';
export * from './identity.user.v1/UserUpdated';
export * from './identity.user.v1/UserDisabled';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

// Initialize AJV validator with formats
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Load and compile schemas
const schemasDir = path.join(__dirname, '..', 'schemas');

// Load envelope schema
const envelopeSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'envelope.v1.json'), 'utf8')
);

// Load identity schemas
const userCreatedSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'identity.user.v1/UserCreated.json'), 'utf8')
);

const userUpdatedSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'identity.user.v1/UserUpdated.json'), 'utf8')
);

const userDisabledSchema = JSON.parse(
  fs.readFileSync(path.join(schemasDir, 'identity.user.v1/UserDisabled.json'), 'utf8')
);

// Compile validators
export const validateEnvelope = ajv.compile(envelopeSchema);
export const validateUserCreated = ajv.compile(userCreatedSchema);
export const validateUserUpdated = ajv.compile(userUpdatedSchema);
export const validateUserDisabled = ajv.compile(userDisabledSchema);

// Event type constants
export const EventTypes = {
  USER_CREATED: 'UserCreated',
  USER_UPDATED: 'UserUpdated',
  USER_DISABLED: 'UserDisabled',
} as const;

export const Topics = {
  IDENTITY_USER_V1: 'identity.user.v1',
} as const;

// Helper function to validate complete event
export function validateEvent(event: unknown): boolean {
  // First validate envelope
  if (!validateEnvelope(event)) {
    console.error('Envelope validation failed:', validateEnvelope.errors);
    return false;
  }

  // Cast event to any for property access after envelope validation
  const validatedEvent = event as any;

  // Then validate payload based on event type
  switch (validatedEvent.event_type) {
    case EventTypes.USER_CREATED:
      if (!validateUserCreated(validatedEvent.payload)) {
        console.error('UserCreated payload validation failed:', validateUserCreated.errors);
        return false;
      }
      break;
    case EventTypes.USER_UPDATED:
      if (!validateUserUpdated(validatedEvent.payload)) {
        console.error('UserUpdated payload validation failed:', validateUserUpdated.errors);
        return false;
      }
      break;
    case EventTypes.USER_DISABLED:
      if (!validateUserDisabled(validatedEvent.payload)) {
        console.error('UserDisabled payload validation failed:', validateUserDisabled.errors);
        return false;
      }
      break;
    default:
      console.error('Unknown event type:', validatedEvent.event_type);
      return false;
  }

  return true;
}