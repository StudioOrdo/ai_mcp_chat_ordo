use crate::redaction::redact_sensitive_values;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const SUPERVISOR_DUMMY_CHILD_SCHEMA_VERSION: &str = "1";
pub const SUPERVISOR_DUMMY_CHILD_RUNTIME_MODE: &str = "pre_integration_runway";

pub const SUPERVISOR_DUMMY_CHILD_SUCCESS_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "runtimeMode": "pre_integration_runway",
  "childId": "dummy_child_success",
  "attempt": 1,
  "status": "exited",
  "exitCode": 0,
  "signal": null,
  "durationMs": 12,
  "timestamp": "2026-05-07T17:00:00.000Z",
  "context": {
    "scenario": "success"
  }
}
"#;

pub const SUPERVISOR_DUMMY_CHILD_NON_ZERO_EXIT_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "runtimeMode": "pre_integration_runway",
  "childId": "dummy_child_non_zero",
  "attempt": 1,
  "status": "exited",
  "exitCode": 23,
  "signal": null,
  "durationMs": 18,
  "timestamp": "2026-05-07T17:01:00.000Z",
  "context": {
    "scenario": "non_zero_exit",
        "authorization": "fixture-supervisor-token",
        "localPath": "fixture-dummy-child-log"
  }
}
"#;

pub const SUPERVISOR_DUMMY_CHILD_TIMEOUT_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "runtimeMode": "pre_integration_runway",
  "childId": "dummy_child_timeout",
  "attempt": 2,
  "status": "timed_out",
  "exitCode": null,
  "signal": null,
  "durationMs": 30000,
  "timestamp": "2026-05-07T17:02:00.000Z",
  "context": {
    "scenario": "timeout",
        "apiKey": "fixture-supervisor-api-key"
  }
}
"#;

pub const SUPERVISOR_DUMMY_CHILD_CANCELED_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "runtimeMode": "pre_integration_runway",
  "childId": "dummy_child_canceled",
  "attempt": 1,
  "status": "canceled",
  "exitCode": null,
  "signal": "SIGTERM",
  "durationMs": 44,
  "timestamp": "2026-05-07T17:03:00.000Z",
  "context": {
    "scenario": "cancellation",
        "cookie": "fixture-supervisor-cookie"
  }
}
"#;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SupervisorDummyChildFixture {
    pub schema_version: String,
    pub runtime_mode: String,
    pub child_id: String,
    pub attempt: u32,
    pub status: String,
    pub exit_code: Option<i32>,
    pub signal: Option<String>,
    pub duration_ms: u64,
    pub timestamp: String,
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SupervisorDummyChildClassification {
    Succeeded,
    NonZeroExit,
    TimedOut,
    Canceled,
    Unknown,
}

pub fn parse_supervisor_dummy_child_fixture(
    json_fixture: &str,
) -> serde_json::Result<SupervisorDummyChildFixture> {
    serde_json::from_str(json_fixture)
}

pub fn classify_supervisor_dummy_child(
    fixture: &SupervisorDummyChildFixture,
) -> SupervisorDummyChildClassification {
    match fixture.status.as_str() {
        "exited" if fixture.exit_code == Some(0) => SupervisorDummyChildClassification::Succeeded,
        "exited" if fixture.exit_code.unwrap_or_default() != 0 => {
            SupervisorDummyChildClassification::NonZeroExit
        }
        "timed_out" => SupervisorDummyChildClassification::TimedOut,
        "canceled" => SupervisorDummyChildClassification::Canceled,
        _ => SupervisorDummyChildClassification::Unknown,
    }
}

pub fn exposed_supervisor_dummy_child_json(
    fixture: &SupervisorDummyChildFixture,
) -> serde_json::Result<Value> {
    let raw_fixture = serde_json::to_value(fixture)?;
    let redacted = redact_sensitive_values(&raw_fixture);

    Ok(json!({
        "schemaVersion": SUPERVISOR_DUMMY_CHILD_SCHEMA_VERSION,
        "runtimeMode": redacted.value["runtimeMode"],
        "childId": redacted.value["childId"],
        "attempt": redacted.value["attempt"],
        "status": redacted.value["status"],
        "exitCode": redacted.value["exitCode"],
        "signal": redacted.value["signal"],
        "durationMs": redacted.value["durationMs"],
        "timestamp": redacted.value["timestamp"],
        "classification": classify_supervisor_dummy_child(fixture),
        "context": redacted.value["context"],
        "redactionApplied": !redacted.fields.is_empty()
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::redaction::REDACTED_VALUE;

    fn parse_fixture(json_fixture: &str) -> SupervisorDummyChildFixture {
        parse_supervisor_dummy_child_fixture(json_fixture).unwrap()
    }

    fn exposed_fixture(json_fixture: &str) -> Value {
        let fixture = parse_fixture(json_fixture);
        exposed_supervisor_dummy_child_json(&fixture).unwrap()
    }

    fn assert_no_raw_sensitive_values(value: &Value) {
        let serialized = serde_json::to_string(value).unwrap();
        assert_serialized_has_no_raw_sensitive_values(&serialized);
    }

    fn assert_serialized_has_no_raw_sensitive_values(serialized: &str) {
        for forbidden in [
            "raw-supervisor-token",
            "raw-supervisor-cookie",
            "sk-supervisor-timeout-fixture",
            "/Users/example",
        ] {
            assert!(
                !serialized.contains(forbidden),
                "supervisor fixture JSON should not contain raw sensitive value: {forbidden}"
            );
        }
    }

    #[test]
    fn dummy_child_fixtures_parse_deterministically() {
        for fixture in [
            SUPERVISOR_DUMMY_CHILD_SUCCESS_JSON_FIXTURE,
            SUPERVISOR_DUMMY_CHILD_NON_ZERO_EXIT_JSON_FIXTURE,
            SUPERVISOR_DUMMY_CHILD_TIMEOUT_JSON_FIXTURE,
            SUPERVISOR_DUMMY_CHILD_CANCELED_JSON_FIXTURE,
        ] {
            let first = parse_fixture(fixture);
            let second = parse_fixture(fixture);
            assert_eq!(first, second);
            assert_eq!(first.schema_version, SUPERVISOR_DUMMY_CHILD_SCHEMA_VERSION);
            assert_eq!(first.runtime_mode, SUPERVISOR_DUMMY_CHILD_RUNTIME_MODE);
        }
    }

    #[test]
    fn dummy_child_classification_is_stable() {
        let cases = [
            (
                SUPERVISOR_DUMMY_CHILD_SUCCESS_JSON_FIXTURE,
                SupervisorDummyChildClassification::Succeeded,
            ),
            (
                SUPERVISOR_DUMMY_CHILD_NON_ZERO_EXIT_JSON_FIXTURE,
                SupervisorDummyChildClassification::NonZeroExit,
            ),
            (
                SUPERVISOR_DUMMY_CHILD_TIMEOUT_JSON_FIXTURE,
                SupervisorDummyChildClassification::TimedOut,
            ),
            (
                SUPERVISOR_DUMMY_CHILD_CANCELED_JSON_FIXTURE,
                SupervisorDummyChildClassification::Canceled,
            ),
        ];

        for (fixture, expected) in cases {
            let parsed = parse_fixture(fixture);
            assert_eq!(classify_supervisor_dummy_child(&parsed), expected);
        }
    }

    #[test]
    fn exposed_dummy_child_json_is_camel_case_and_preserves_safe_fields() {
        let exposed = exposed_fixture(SUPERVISOR_DUMMY_CHILD_NON_ZERO_EXIT_JSON_FIXTURE);

        assert_eq!(
            exposed["schemaVersion"],
            SUPERVISOR_DUMMY_CHILD_SCHEMA_VERSION
        );
        assert_eq!(exposed["runtimeMode"], SUPERVISOR_DUMMY_CHILD_RUNTIME_MODE);
        assert_eq!(exposed["childId"], "dummy_child_non_zero");
        assert_eq!(exposed["attempt"], 1);
        assert_eq!(exposed["status"], "exited");
        assert_eq!(exposed["exitCode"], 23);
        assert_eq!(exposed["signal"], Value::Null);
        assert_eq!(exposed["durationMs"], 18);
        assert_eq!(exposed["timestamp"], "2026-05-07T17:01:00.000Z");
        assert_eq!(exposed["classification"], "non_zero_exit");

        let serialized = serde_json::to_string(&exposed).unwrap();
        assert!(serialized.contains("schemaVersion"));
        assert!(serialized.contains("runtimeMode"));
        assert!(serialized.contains("durationMs"));
        assert!(!serialized.contains("schema_version"));
        assert!(!serialized.contains("runtime_mode"));
        assert!(!serialized.contains("duration_ms"));
    }

    #[test]
    fn sensitive_context_is_redacted_before_exposure() {
        let non_zero = exposed_fixture(SUPERVISOR_DUMMY_CHILD_NON_ZERO_EXIT_JSON_FIXTURE);
        let timeout = exposed_fixture(SUPERVISOR_DUMMY_CHILD_TIMEOUT_JSON_FIXTURE);
        let canceled = exposed_fixture(SUPERVISOR_DUMMY_CHILD_CANCELED_JSON_FIXTURE);

        assert_eq!(non_zero["context"]["authorization"], REDACTED_VALUE);
        assert_eq!(non_zero["context"]["localPath"], REDACTED_VALUE);
        assert_eq!(timeout["context"]["apiKey"], REDACTED_VALUE);
        assert_eq!(canceled["context"]["cookie"], REDACTED_VALUE);
        assert_eq!(non_zero["redactionApplied"], true);
        assert_eq!(timeout["redactionApplied"], true);
        assert_eq!(canceled["redactionApplied"], true);
        assert_no_raw_sensitive_values(&non_zero);
        assert_no_raw_sensitive_values(&timeout);
        assert_no_raw_sensitive_values(&canceled);
    }

    #[test]
    fn raw_dummy_child_fixtures_do_not_leak_sensitive_values_after_exposure() {
        for fixture in [
            SUPERVISOR_DUMMY_CHILD_SUCCESS_JSON_FIXTURE,
            SUPERVISOR_DUMMY_CHILD_NON_ZERO_EXIT_JSON_FIXTURE,
            SUPERVISOR_DUMMY_CHILD_TIMEOUT_JSON_FIXTURE,
            SUPERVISOR_DUMMY_CHILD_CANCELED_JSON_FIXTURE,
        ] {
            assert_serialized_has_no_raw_sensitive_values(fixture);
            let exposed = exposed_fixture(fixture);
            assert_no_raw_sensitive_values(&exposed);
        }
    }
}
