# Environment Matrix

## Runtime Environments

| Environment | Purpose | Required Config | Optional Config |
| --- | --- | --- | --- |
| dev | Local development | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL`, `ANTHROPIC_REQUEST_TIMEOUT_MS`, `ANTHROPIC_RETRY_ATTEMPTS`, `ANTHROPIC_RETRY_DELAY_MS` |
| staging | Pre-production validation | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL`, `ANTHROPIC_REQUEST_TIMEOUT_MS`, `ANTHROPIC_RETRY_ATTEMPTS`, `ANTHROPIC_RETRY_DELAY_MS` |
| production | Live traffic | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL`, `ANTHROPIC_REQUEST_TIMEOUT_MS`, `ANTHROPIC_RETRY_ATTEMPTS`, `ANTHROPIC_RETRY_DELAY_MS` |

## Template Files

- `.env.example`
- `.env.staging.example`
- `.env.production.example`

## Parity Rules

- Keep identical key sets across all env templates.
- Avoid legacy aliases in new deployments.
- Validate parity with `npm run parity:env`.
- Validate runtime parity profile with `docker compose up --build`.

## Recommended Anthropic Resilience Defaults

- `ANTHROPIC_REQUEST_TIMEOUT_MS=10000`
- `ANTHROPIC_RETRY_ATTEMPTS=2`
- `ANTHROPIC_RETRY_DELAY_MS=150`
