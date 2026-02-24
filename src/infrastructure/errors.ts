export class MarketplaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceError";
  }
}

export class AuthenticationError extends MarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class LicenseRequiredError extends MarketplaceError {
  constructor(
    public requiredTier: string,
    message: string
  ) {
    super(message);
    this.name = "LicenseRequiredError";
  }
}

export class NotFoundError extends MarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends MarketplaceError {
  constructor(public retryAfter: number) {
    super(`Rate limited. Try again in ${retryAfter}s`);
    this.name = "RateLimitError";
  }
}

export class ServerError extends MarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "ServerError";
  }
}

export class NetworkError extends MarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class SignatureVerificationError extends MarketplaceError {
  constructor(message: string) {
    super(message);
    this.name = "SignatureVerificationError";
  }
}
