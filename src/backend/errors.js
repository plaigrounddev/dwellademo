export class BackendError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "BackendError";
    this.code = code;
    this.details = details;
  }
}

export function assertRequired(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new BackendError("validation.required", `${name} is required`);
  }
}

export function assertKnown(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new BackendError("validation.unknown", `${name} must be one of: ${allowed.join(", ")}`);
  }
}
