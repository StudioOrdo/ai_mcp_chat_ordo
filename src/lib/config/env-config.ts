import { z } from "zod";

function normalizeOptionalEnv(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

const optionalString = z.preprocess(normalizeOptionalEnv, z.string().optional());
const optionalNonEmptyString = z.preprocess(normalizeOptionalEnv, z.string().min(1).optional());
const optionalPositiveInt = z.preprocess(
  normalizeOptionalEnv,
  z.coerce.number().int().positive().optional(),
);
const optionalPercent = z.preprocess(
  normalizeOptionalEnv,
  z.coerce.number().min(0).max(100).optional(),
);
const optionalDockerSize = z.preprocess(
  normalizeOptionalEnv,
  z.string().regex(/^[1-9]\d*(?:b|k|m|g)$/i).optional(),
);
const optionalPositiveDecimalString = z.preprocess(
  normalizeOptionalEnv,
  z.string().regex(/^(?:[1-9]\d*|0\.\d+|[1-9]\d*\.\d+)$/).optional(),
);
const optionalHostedMode = z.preprocess(
  normalizeOptionalEnv,
  z.enum(["reverse_proxy"]).optional(),
);
const optionalBooleanString = z.preprocess(
  normalizeOptionalEnv,
  z.enum(["0", "1", "true", "false"]).optional(),
);

const EnvSchema = z.object({
  // Runtime
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),

  // API Keys
  ANTHROPIC_API_KEY: optionalNonEmptyString,
  API__ANTHROPIC_API_KEY: optionalNonEmptyString,
  OPENAI_API_KEY: optionalNonEmptyString,
  API__OPENAI_API_KEY: optionalNonEmptyString,
  DEEPSEEK_API_KEY: optionalNonEmptyString,
  ANTHROPIC_API_KEY_FILE: optionalNonEmptyString,
  API__ANTHROPIC_API_KEY_FILE: optionalNonEmptyString,
  OPENAI_API_KEY_FILE: optionalNonEmptyString,
  API__OPENAI_API_KEY_FILE: optionalNonEmptyString,
  DEEPSEEK_API_KEY_FILE: optionalNonEmptyString,
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_API_KEY_FILE: optionalNonEmptyString,

  // Provider model / retry config
  AI_PROVIDER: optionalString,
  ANTHROPIC_MODEL: optionalString,
  API__ANTHROPIC_MODEL: optionalString,
  ANTHROPIC_BASE_URL: optionalString,
  ANTHROPIC_REQUEST_TIMEOUT_MS: optionalPositiveInt,
  ANTHROPIC_RETRY_ATTEMPTS: optionalPositiveInt,
  ANTHROPIC_RETRY_DELAY_MS: optionalPositiveInt,
  DEEPSEEK_MODEL: optionalString,
  DEEPSEEK_BASE_URL: optionalString,
  DEEPSEEK_REQUEST_TIMEOUT_MS: optionalPositiveInt,
  DEEPSEEK_RETRY_ATTEMPTS: optionalPositiveInt,
  DEEPSEEK_RETRY_DELAY_MS: optionalPositiveInt,
  IMAGE_PROVIDER: optionalString,
  IMAGE_MODEL: optionalString,
  TTS_PROVIDER: optionalString,
  TTS_MODEL: optionalString,
  STT_PROVIDER: optionalString,
  STT_MODEL: optionalString,
  STT_BASE_URL: optionalString,
  WEB_SEARCH_PROVIDER: optionalString,
  WEB_SEARCH_MODEL: optionalString,
  MEDIA_WORKER_URL: optionalString,
  MEDIA_WORKER_SHARED_SECRET: optionalString,
  MEDIA_WORKER_SHARED_SECRET_FILE: optionalNonEmptyString,
  MEDIA_WORKER_PORT: optionalPositiveInt,

  // Database
  STUDIO_ORDO_DB_PATH: optionalString,
  DATA_DIR: z.string().default(".data"),

  // Deferred jobs
  DEFERRED_JOB_POLL_INTERVAL_MS: optionalPositiveInt,
  DEFERRED_JOB_WORKER_ID: optionalString,

  // Job event streaming
  JOB_EVENT_STREAM_POLL_INTERVAL_MS: optionalPositiveInt,
  JOB_EVENT_STREAM_MAX_DURATION_MS: optionalPositiveInt,

  // Push notifications
  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: optionalString,
  WEB_PUSH_VAPID_PUBLIC_KEY: optionalString,
  WEB_PUSH_VAPID_PRIVATE_KEY: optionalString,
  WEB_PUSH_VAPID_PRIVATE_KEY_FILE: optionalNonEmptyString,
  WEB_PUSH_SUBJECT: optionalString,

  // Auth
  BCRYPT_ROUNDS: optionalPositiveInt,

  // Config
  CONFIG_DIR: optionalString,
  HOSTNAME: optionalString,
  SHUTDOWN_TIMEOUT_MS: optionalPositiveInt,
  ORDO_HOSTED_MODE: optionalHostedMode,
  ORDO_PUBLIC_ORIGIN: optionalString,
  PUBLIC_SITE_ORIGIN: optionalString,
  NEXT_PUBLIC_SITE_ORIGIN: optionalString,
  TRUST_PROXY_HEADERS: optionalBooleanString,
  ALLOWED_ORIGINS: optionalString,
  ORDO_INSTALL_TOKEN: optionalNonEmptyString,
  ORDO_INSTALL_TOKEN_FILE: optionalNonEmptyString,
  ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN: optionalNonEmptyString,
  ORDO_INTERNAL_RUNTIME_SERVICE_TOKEN_FILE: optionalNonEmptyString,

  // Appliance resource posture
  ORDO_DATA_FREE_WARN_BYTES: optionalPositiveInt,
  ORDO_DATA_FREE_WARN_PERCENT: optionalPercent,
  ORDO_DATA_FREE_BLOCK_BYTES: optionalPositiveInt,
  ORDO_DATA_FREE_BLOCK_PERCENT: optionalPercent,
  ORDO_TMP_SIZE: optionalDockerSize,
  ORDO_RUNTIME_LOG_TMPFS_SIZE: optionalDockerSize,
  ORDO_NEXT_CACHE_TMPFS_SIZE: optionalDockerSize,
  ORDO_PIDS_LIMIT: optionalPositiveInt,
  ORDO_MEMORY_RESERVATION: optionalDockerSize,
  ORDO_MEMORY_LIMIT: optionalDockerSize,
  ORDO_CPUS: optionalPositiveDecimalString,
  ORDO_LOG_MAX_SIZE: optionalDockerSize,
  ORDO_LOG_MAX_FILE: optionalPositiveInt,
  ORDO_WORKER_MAX_RESTARTS: optionalPositiveInt,
  ORDO_WORKER_RESTART_WINDOW_MS: optionalPositiveInt,

  // Dev-only feature flags
  ENABLE_DEV_ROLE_SWITCH: optionalString,
}).superRefine((value, ctx) => {
  if (
    value.ORDO_DATA_FREE_BLOCK_BYTES !== undefined
    && value.ORDO_DATA_FREE_WARN_BYTES !== undefined
    && value.ORDO_DATA_FREE_BLOCK_BYTES > value.ORDO_DATA_FREE_WARN_BYTES
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ORDO_DATA_FREE_BLOCK_BYTES"],
      message: "ORDO_DATA_FREE_BLOCK_BYTES cannot exceed ORDO_DATA_FREE_WARN_BYTES.",
    });
  }
  if (
    value.ORDO_DATA_FREE_BLOCK_PERCENT !== undefined
    && value.ORDO_DATA_FREE_WARN_PERCENT !== undefined
    && value.ORDO_DATA_FREE_BLOCK_PERCENT > value.ORDO_DATA_FREE_WARN_PERCENT
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ORDO_DATA_FREE_BLOCK_PERCENT"],
      message: "ORDO_DATA_FREE_BLOCK_PERCENT cannot exceed ORDO_DATA_FREE_WARN_PERCENT.",
    });
  }
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let _config: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!_config) {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      const formatted = result.error.flatten();
      throw new Error(
        `Environment validation failed:\n${JSON.stringify(formatted.fieldErrors, null, 2)}`,
      );
    }
    _config = result.data;
  }
  return _config;
}

/** @internal — test-only */
export function _resetEnvConfig(): void {
  _config = null;
}
