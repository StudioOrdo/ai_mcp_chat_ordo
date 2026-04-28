export const COMPOSE_MEDIA_INVALID_PLAN_ERROR_CODE = "INVALID_PLAN";
export const COMPOSE_MEDIA_INVALID_PLAN_FAILURE_CODE = "invalid_plan";
export const COMPOSE_MEDIA_SOURCE_REHYDRATION_FAILURE_CODE = "source_rehydration_failed";

export type ComposeMediaFailureStage = "composition_preflight" | "local_execution";

export class ComposeMediaError extends Error {
  constructor(
    message: string,
    public readonly failureCode: string,
    public readonly failureStage: ComposeMediaFailureStage,
    public readonly assetId?: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "ComposeMediaError";
    if (options && "cause" in options) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      failureCode: this.failureCode,
      failureStage: this.failureStage,
      ...(this.assetId ? { assetId: this.assetId } : {}),
    };
  }
}

export function isComposeMediaInvalidPlanErrorCode(
  value: unknown,
): value is typeof COMPOSE_MEDIA_INVALID_PLAN_ERROR_CODE {
  return value === COMPOSE_MEDIA_INVALID_PLAN_ERROR_CODE;
}

export class ComposeMediaSourceRehydrationError extends ComposeMediaError {
  constructor(
    message: string,
    public readonly failureCode: string = COMPOSE_MEDIA_SOURCE_REHYDRATION_FAILURE_CODE,
    assetId?: string,
    options?: { cause?: unknown },
  ) {
    super(message, failureCode, "composition_preflight", assetId, options);
    this.name = "ComposeMediaSourceRehydrationError";
  }
}

export class ComposeMediaNetworkError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "network_unreachable", "composition_preflight", assetId, options);
    this.name = "ComposeMediaNetworkError";
  }
}

export class ComposeMediaCorsError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "cors_blocked", "composition_preflight", assetId, options);
    this.name = "ComposeMediaCorsError";
  }
}

export class ComposeMediaNotFoundError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "asset_not_found", "composition_preflight", assetId, options);
    this.name = "ComposeMediaNotFoundError";
  }
}

export class ComposeMediaForbiddenError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "asset_forbidden", "composition_preflight", assetId, options);
    this.name = "ComposeMediaForbiddenError";
  }
}

export class ComposeMediaEmptyAssetError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "asset_empty", "composition_preflight", assetId, options);
    this.name = "ComposeMediaEmptyAssetError";
  }
}

export class ComposeMediaMalformedAssetError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "asset_malformed_json", "composition_preflight", assetId, options);
    this.name = "ComposeMediaMalformedAssetError";
  }
}

export class ComposeMediaRenderError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "render_failed", "local_execution", assetId, options);
    this.name = "ComposeMediaRenderError";
  }
}

export class ComposeMediaPersistenceError extends ComposeMediaError {
  constructor(message: string, assetId?: string, options?: { cause?: unknown }) {
    super(message, "asset_persistence_failed", "local_execution", assetId, options);
    this.name = "ComposeMediaPersistenceError";
  }
}