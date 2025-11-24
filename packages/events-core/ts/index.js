"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Topics = exports.EventTypes = exports.validateUserDisabled = exports.validateUserUpdated = exports.validateUserCreated = exports.validateEnvelope = void 0;
exports.validateEvent = validateEvent;
// Export generated types
__exportStar(require("./envelope.v1"), exports);
__exportStar(require("./identity.user.v1/UserCreated"), exports);
__exportStar(require("./identity.user.v1/UserUpdated"), exports);
__exportStar(require("./identity.user.v1/UserDisabled"), exports);
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Initialize AJV validator with formats
const ajv = new ajv_1.default({ allErrors: true });
(0, ajv_formats_1.default)(ajv);
// Load and compile schemas
const schemasDir = path.join(__dirname, '..', 'schemas');
// Load envelope schema
const envelopeSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'envelope.v1.json'), 'utf8'));
// Load identity schemas
const userCreatedSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'identity.user.v1/UserCreated.json'), 'utf8'));
const userUpdatedSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'identity.user.v1/UserUpdated.json'), 'utf8'));
const userDisabledSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, 'identity.user.v1/UserDisabled.json'), 'utf8'));
// Compile validators
exports.validateEnvelope = ajv.compile(envelopeSchema);
exports.validateUserCreated = ajv.compile(userCreatedSchema);
exports.validateUserUpdated = ajv.compile(userUpdatedSchema);
exports.validateUserDisabled = ajv.compile(userDisabledSchema);
// Event type constants
exports.EventTypes = {
    USER_CREATED: 'UserCreated',
    USER_UPDATED: 'UserUpdated',
    USER_DISABLED: 'UserDisabled',
};
exports.Topics = {
    IDENTITY_USER_V1: 'identity.user.v1',
};
// Helper function to validate complete event
function validateEvent(event) {
    // First validate envelope
    if (!(0, exports.validateEnvelope)(event)) {
        console.error('Envelope validation failed:', exports.validateEnvelope.errors);
        return false;
    }
    // Cast event to any for property access after envelope validation
    const validatedEvent = event;
    // Then validate payload based on event type
    switch (validatedEvent.event_type) {
        case exports.EventTypes.USER_CREATED:
            if (!(0, exports.validateUserCreated)(validatedEvent.payload)) {
                console.error('UserCreated payload validation failed:', exports.validateUserCreated.errors);
                return false;
            }
            break;
        case exports.EventTypes.USER_UPDATED:
            if (!(0, exports.validateUserUpdated)(validatedEvent.payload)) {
                console.error('UserUpdated payload validation failed:', exports.validateUserUpdated.errors);
                return false;
            }
            break;
        case exports.EventTypes.USER_DISABLED:
            if (!(0, exports.validateUserDisabled)(validatedEvent.payload)) {
                console.error('UserDisabled payload validation failed:', exports.validateUserDisabled.errors);
                return false;
            }
            break;
        default:
            console.error('Unknown event type:', validatedEvent.event_type);
            return false;
    }
    return true;
}
//# sourceMappingURL=index.js.map