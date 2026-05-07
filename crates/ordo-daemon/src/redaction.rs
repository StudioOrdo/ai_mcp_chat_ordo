use serde_json::{Map, Value};

pub const REDACTED_VALUE: &str = "[redacted]";
const MAX_REDACTION_DEPTH: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedactionResult {
    pub value: Value,
    pub fields: Vec<String>,
}

pub fn redact_sensitive_values(value: &Value) -> RedactionResult {
    let mut fields = Vec::new();
    let redacted = redact_value(value, &mut fields, "", 0);
    fields.sort();
    fields.dedup();
    RedactionResult {
        value: redacted,
        fields,
    }
}

fn redact_value(value: &Value, fields: &mut Vec<String>, path: &str, depth: usize) -> Value {
    if depth >= MAX_REDACTION_DEPTH {
        return match value {
            Value::Array(_) => Value::String("[array]".to_string()),
            Value::Object(_) => Value::String("[object]".to_string()),
            _ => redact_string_value(value, fields, path),
        };
    }

    match value {
        Value::Array(entries) => Value::Array(
            entries
                .iter()
                .enumerate()
                .map(|(index, entry)| {
                    redact_value(entry, fields, &array_path(path, index), depth + 1)
                })
                .collect(),
        ),
        Value::Object(entries) => Value::Object(redact_object(entries, fields, path, depth)),
        _ => redact_string_value(value, fields, path),
    }
}

fn redact_object(
    entries: &Map<String, Value>,
    fields: &mut Vec<String>,
    path: &str,
    depth: usize,
) -> Map<String, Value> {
    entries
        .iter()
        .map(|(key, entry)| {
            let child_path = child_path(path, key);
            if is_sensitive_key(key) {
                fields.push(child_path);
                (key.clone(), Value::String(REDACTED_VALUE.to_string()))
            } else {
                (
                    key.clone(),
                    redact_value(entry, fields, &child_path, depth + 1),
                )
            }
        })
        .collect()
}

fn redact_string_value(value: &Value, fields: &mut Vec<String>, path: &str) -> Value {
    let Value::String(text) = value else {
        return value.clone();
    };

    if contains_local_user_path(text) {
        fields.push(path_or_root(path));
        return Value::String(REDACTED_VALUE.to_string());
    }

    if let Some(redacted) = redact_bearer_token(text) {
        fields.push(path_or_root(path));
        return Value::String(redacted);
    }

    value.clone()
}

fn is_sensitive_key(key: &str) -> bool {
    let normalized = key
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect::<String>();

    [
        "apikey",
        "authorization",
        "bearer",
        "cookie",
        "credential",
        "password",
        "passwd",
        "privatekey",
        "secret",
        "session",
        "token",
        "accesstoken",
        "refreshtoken",
        "userhome",
        "homedir",
        "homepath",
        "localpath",
        "filepath",
        "databasepath",
        "dbpath",
    ]
    .iter()
    .any(|term| normalized.contains(term))
}

fn contains_local_user_path(value: &str) -> bool {
    value.contains("/Users/") || value.contains("/home/") || value.contains("\\Users\\")
}

fn redact_bearer_token(value: &str) -> Option<String> {
    let lower = value.to_ascii_lowercase();
    let bearer_index = lower.find("bearer ")?;
    let token_start = bearer_index + "bearer ".len();
    let token_end = value[token_start..]
        .find(char::is_whitespace)
        .map(|offset| token_start + offset)
        .unwrap_or(value.len());

    let mut redacted = String::with_capacity(value.len());
    redacted.push_str(&value[..bearer_index]);
    redacted.push_str("Bearer ");
    redacted.push_str(REDACTED_VALUE);
    redacted.push_str(&value[token_end..]);
    Some(redacted)
}

fn child_path(parent_path: &str, key: &str) -> String {
    if parent_path.is_empty() {
        key.to_string()
    } else {
        format!("{parent_path}.{key}")
    }
}

fn array_path(parent_path: &str, index: usize) -> String {
    if parent_path.is_empty() {
        format!("[{index}]")
    } else {
        format!("{parent_path}[{index}]")
    }
}

fn path_or_root(path: &str) -> String {
    if path.is_empty() {
        "$".to_string()
    } else {
        path.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runway_fixtures::{
        DAEMON_HEALTH_JSON_FIXTURE, NODE_JOB_EVENT_JSON_FIXTURE, NODE_JOB_STREAM_EVENT_JSON_FIXTURE,
    };
    use crate::runway_schema_snapshots::all_snapshot_descriptors;
    use serde_json::json;

    #[test]
    fn redacts_nested_sensitive_keys_with_stable_marker() {
        let value = json!({
            "jobId": "job_fixture_001",
            "provider": {
                "apiKey": "sk-live-value",
                "nested": {
                    "private_key": "private-key-value",
                    "credentials": {
                        "password": "open-sesame"
                    }
                }
            },
            "headers": {
                "authorization": "Bearer raw-token-value",
                "cookie": "ordo_session=raw-cookie"
            }
        });

        let result = redact_sensitive_values(&value);

        assert_eq!(result.value["jobId"], "job_fixture_001");
        assert_eq!(result.value["provider"]["apiKey"], REDACTED_VALUE);
        assert_eq!(
            result.value["provider"]["nested"]["private_key"],
            REDACTED_VALUE
        );
        assert_eq!(
            result.value["provider"]["nested"]["credentials"],
            REDACTED_VALUE
        );
        assert_eq!(result.value["headers"]["authorization"], REDACTED_VALUE);
        assert_eq!(result.value["headers"]["cookie"], REDACTED_VALUE);
        assert_eq!(
            result.fields,
            vec![
                "headers.authorization",
                "headers.cookie",
                "provider.apiKey",
                "provider.nested.credentials",
                "provider.nested.private_key",
            ]
        );
    }

    #[test]
    fn traverses_arrays_and_preserves_safe_job_fields() {
        let value = json!({
            "mode": "pre_integration_runway",
            "events": [
                {
                    "jobId": "job_fixture_001",
                    "conversationId": "conv_fixture_001",
                    "status": "running",
                    "eventType": "progress",
                    "progressPercent": 42,
                    "token": "raw-token-value"
                }
            ]
        });

        let result = redact_sensitive_values(&value);
        let event = &result.value["events"][0];

        assert_eq!(result.value["mode"], "pre_integration_runway");
        assert_eq!(event["jobId"], "job_fixture_001");
        assert_eq!(event["conversationId"], "conv_fixture_001");
        assert_eq!(event["status"], "running");
        assert_eq!(event["eventType"], "progress");
        assert_eq!(event["progressPercent"], 42);
        assert_eq!(event["token"], REDACTED_VALUE);
        assert_eq!(result.fields, vec!["events[0].token"]);
    }

    #[test]
    fn redacts_bearer_tokens_and_local_user_paths_in_strings() {
        let value = json!({
            "message": "request failed with Bearer raw-token-value",
            "stackPath": "/Users/example/.ordo/crash.log",
            "safePath": "src/lib/jobs/job-event-stream.ts"
        });

        let result = redact_sensitive_values(&value);
        let serialized = serde_json::to_string(&result.value).unwrap();

        assert_eq!(
            result.value["message"],
            "request failed with Bearer [redacted]"
        );
        assert_eq!(result.value["stackPath"], REDACTED_VALUE);
        assert_eq!(result.value["safePath"], "src/lib/jobs/job-event-stream.ts");
        assert!(!serialized.contains("raw-token-value"));
        assert!(!serialized.contains("/Users/example"));
    }

    #[test]
    fn safe_runway_fixtures_are_unchanged_by_redaction() {
        for fixture in [
            DAEMON_HEALTH_JSON_FIXTURE,
            NODE_JOB_EVENT_JSON_FIXTURE,
            NODE_JOB_STREAM_EVENT_JSON_FIXTURE,
        ] {
            let value: Value = serde_json::from_str(fixture).unwrap();
            let result = redact_sensitive_values(&value);
            assert_eq!(result.value, value);
            assert!(result.fields.is_empty());
            assert!(!fixture.contains(REDACTED_VALUE));
        }
    }

    #[test]
    fn schema_snapshot_descriptors_remain_safe_after_redaction_checks() {
        for descriptor in all_snapshot_descriptors() {
            let result = redact_sensitive_values(&descriptor);
            assert_eq!(result.value, descriptor);
            assert!(result.fields.is_empty());
        }
    }
}
