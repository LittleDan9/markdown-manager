export * from './envelope.v1';
export * from './identity.user.v1/UserCreated';
export * from './identity.user.v1/UserUpdated';
export * from './identity.user.v1/UserDisabled';
export declare const validateEnvelope: import("ajv").ValidateFunction<unknown>;
export declare const validateUserCreated: import("ajv").ValidateFunction<unknown>;
export declare const validateUserUpdated: import("ajv").ValidateFunction<unknown>;
export declare const validateUserDisabled: import("ajv").ValidateFunction<unknown>;
export declare const EventTypes: {
    readonly USER_CREATED: "UserCreated";
    readonly USER_UPDATED: "UserUpdated";
    readonly USER_DISABLED: "UserDisabled";
};
export declare const Topics: {
    readonly IDENTITY_USER_V1: "identity.user.v1";
};
export declare function validateEvent(event: unknown): boolean;
//# sourceMappingURL=index.d.ts.map