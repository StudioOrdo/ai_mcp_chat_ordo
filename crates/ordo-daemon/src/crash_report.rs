use crate::redaction::redact_sensitive_values;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const CRASH_REPORT_SCHEMA_VERSION: &str = "1";

pub const TRANSIENT_CRASH_REPORT_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "service": "ordo-daemon",
  "mode": "pre_integration_runway",
  "timestamp": "2026-05-07T15:00:00.000Z",
  "category": "native_process",
  "event": "worker_crashed",
  "jobId": "job_fixture_001",
  "eventType": "failed",
  "failureClass": "transient",
  "error": {
    "code": "worker_restart_window",
    "message": "Native worker exited unexpectedly and can be retried.",
    "stackPath": "/Users/example/.ordo/crash.log"
  },
  "context": {
    "attempt": 2,
    "authorization": "Bearer raw-token-value",
    "cookie": "ordo_session=raw-cookie",
    "provider": {
      "apiKey": "sk-fixture-value",
      "privateKey": "private-key-fixture"
    },
    "paths": ["/Users/example/.ordo/native-worker.log"]
  }
}
"#;

pub const POLICY_CRASH_REPORT_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "service": "ordo-daemon",
  "mode": "pre_integration_runway",
  "timestamp": "2026-05-07T15:01:00.000Z",
  "category": "native_process",
  "event": "policy_rejected",
  "jobId": "job_fixture_policy",
  "eventType": "failed",
  "failureClass": "policy",
  "error": {
    "code": "policy_rejected",
    "message": "Requested operation was rejected by policy."
  },
  "context": {
    "attempt": 1,
    "toolName": "generate_chart"
  }
}
"#;

pub const TERMINAL_CRASH_REPORT_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "service": "ordo-daemon",
  "mode": "pre_integration_runway",
  "timestamp": "2026-05-07T15:02:00.000Z",
  "category": "native_process",
  "event": "worker_panicked",
  "jobId": "job_fixture_terminal",
  "eventType": "failed",
  "failureClass": "terminal",
  "error": {
    "code": "panic",
    "message": "Worker reached an unrecoverable state."
  },
  "context": {
    "attempt": 3,
    "toolName": "generate_graph"
  }
}
"#;

pub const CONFIG_CRASH_REPORT_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "service": "ordo-daemon",
  "mode": "pre_integration_runway",
  "timestamp": "2026-05-07T15:03:00.000Z",
  "category": "native_process",
  "event": "config_missing",
  "jobId": "job_fixture_config",
  "eventType": "failed",
  "failureClass": "unknown",
  "error": {
    "code": "missing_config",
    "message": "Required native runtime configuration is missing."
  },
  "context": {
    "attempt": 1,
    "token": "raw-config-token"
  }
}
"#;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CrashReportClassification {
    Config,
    Policy,
    Transient,
    Terminal,
    Unknown,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CrashReportError {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stack_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrashReportFixture {
    pub schema_version: String,
    pub service: String,
    pub mode: String,
    pub timestamp: String,
    pub category: String,
    pub event: String,
    pub job_id: String,
    pub event_type: String,
    pub failure_class: String,
    pub error: CrashReportError,
    #[serde(default)]
    pub context: Value,
}

pub fn parse_crash_report_fixture(json_fixture: &str) -> serde_json::Result<CrashReportFixture> {
    serde_json::from_str(json_fixture)
}

pub fn classify_crash_report(report: &CrashReportFixture) -> CrashReportClassification {
    let error_code = report.error.code.to_ascii_lowercase();
    let event = report.event.to_ascii_lowercase();

    if error_code.contains("config") || event.contains("config") {
        return CrashReportClassification::Config;
    }

    match report.failure_class.as_str() {
        "policy" => CrashReportClassification::Policy,
        "transient" => CrashReportClassification::Transient,
        "terminal" => CrashReportClassification::Terminal,
        _ => CrashReportClassification::Unknown,
    }
}

pub fn exposed_crash_report_json(report: &CrashReportFixture) -> serde_json::Result<Value> {
    let raw_report = serde_json::to_value(report)?;
    let redacted = redact_sensitive_values(&raw_report);
    Ok(json!({
        "schemaVersion": CRASH_REPORT_SCHEMA_VERSION,
        "service": redacted.value["service"],
        "mode": redacted.value["mode"],
        "timestamp": redacted.value["timestamp"],
        "category": redacted.value["category"],
        "event": redacted.value["event"],
        "jobId": redacted.value["jobId"],
        "eventType": redacted.value["eventType"],
        "failureClass": redacted.value["failureClass"],
        "classification": classify_crash_report(report),
        "error": redacted.value["error"],
        "context": redacted.value["context"],
        "redactionApplied": !redacted.fields.is_empty(),
        "redactedFieldCount": redacted.fields.len()
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health::{DAEMON_SERVICE_NAME, PRE_INTEGRATION_MODE};
    use crate::redaction::REDACTED_VALUE;
    use crate::runway_fixtures::{
        DAEMON_HEALTH_JSON_FIXTURE, NODE_JOB_EVENT_JSON_FIXTURE, NODE_JOB_STREAM_EVENT_JSON_FIXTURE,
    };
    use crate::runway_schema_snapshots::all_snapshot_descriptors;

    fn exposed_fixture(json_fixture: &str) -> Value {
        let report = parse_crash_report_fixture(json_fixture).unwrap();
        exposed_crash_report_json(&report).unwrap()
    }

    fn assert_exposed_report_has_no_raw_sensitive_values(value: &Value) {
        let serialized = serde_json::to_string(value).unwrap();
        for forbidden in [
            "raw-token-value",
            "raw-cookie",
            "sk-fixture-value",
            "private-key-fixture",
            "/Users/example",
            "raw-config-token",
        ] {
            assert!(
                !serialized.contains(forbidden),
                "exposed report should not contain raw sensitive value: {forbidden}"
            );
        }
    }

    #[test]
    fn crash_report_fixtures_parse_deterministically() {
        let first = parse_crash_report_fixture(TRANSIENT_CRASH_REPORT_JSON_FIXTURE).unwrap();
        let second = parse_crash_report_fixture(TRANSIENT_CRASH_REPORT_JSON_FIXTURE).unwrap();

        assert_eq!(first, second);
        assert_eq!(first.schema_version, CRASH_REPORT_SCHEMA_VERSION);
        assert_eq!(first.service, DAEMON_SERVICE_NAME);
        assert_eq!(first.mode, PRE_INTEGRATION_MODE);
        assert_eq!(first.category, "native_process");
        assert_eq!(first.job_id, "job_fixture_001");
    }

    #[test]
    fn classifier_is_stable_for_known_fixture_cases() {
        let cases = [
            (
                TRANSIENT_CRASH_REPORT_JSON_FIXTURE,
                CrashReportClassification::Transient,
            ),
            (
                POLICY_CRASH_REPORT_JSON_FIXTURE,
                CrashReportClassification::Policy,
            ),
            (
                TERMINAL_CRASH_REPORT_JSON_FIXTURE,
                CrashReportClassification::Terminal,
            ),
            (
                CONFIG_CRASH_REPORT_JSON_FIXTURE,
                CrashReportClassification::Config,
            ),
        ];

        for (json_fixture, expected) in cases {
            let report = parse_crash_report_fixture(json_fixture).unwrap();
            assert_eq!(classify_crash_report(&report), expected);
        }
    }

    #[test]
    fn exposed_report_redacts_sensitive_nested_fields_before_exposure() {
        let exposed = exposed_fixture(TRANSIENT_CRASH_REPORT_JSON_FIXTURE);

        assert_eq!(exposed["error"]["stackPath"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["authorization"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["cookie"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["provider"]["apiKey"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["provider"]["privateKey"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["paths"][0], REDACTED_VALUE);
        assert_eq!(exposed["redactionApplied"], true);
        assert_eq!(exposed["redactedFieldCount"], 6);
        assert_exposed_report_has_no_raw_sensitive_values(&exposed);
    }

    #[test]
    fn exposed_report_preserves_safe_boundary_fields() {
        let exposed = exposed_fixture(TRANSIENT_CRASH_REPORT_JSON_FIXTURE);

        assert_eq!(exposed["service"], DAEMON_SERVICE_NAME);
        assert_eq!(exposed["mode"], PRE_INTEGRATION_MODE);
        assert_eq!(exposed["timestamp"], "2026-05-07T15:00:00.000Z");
        assert_eq!(exposed["jobId"], "job_fixture_001");
        assert_eq!(exposed["eventType"], "failed");
        assert_eq!(exposed["failureClass"], "transient");
        assert_eq!(exposed["classification"], "transient");
        assert_eq!(exposed["context"]["attempt"], 2);
    }

    #[test]
    fn config_fixture_redacts_before_exposure_and_classifies_config() {
        let exposed = exposed_fixture(CONFIG_CRASH_REPORT_JSON_FIXTURE);

        assert_eq!(exposed["classification"], "config");
        assert_eq!(exposed["failureClass"], "unknown");
        assert_eq!(exposed["context"]["token"], REDACTED_VALUE);
        assert_exposed_report_has_no_raw_sensitive_values(&exposed);
    }

    #[test]
    fn existing_fixture_and_schema_surfaces_remain_parseable_and_safe() {
        for fixture in [
            DAEMON_HEALTH_JSON_FIXTURE,
            NODE_JOB_EVENT_JSON_FIXTURE,
            NODE_JOB_STREAM_EVENT_JSON_FIXTURE,
        ] {
            let value: Value = serde_json::from_str(fixture).unwrap();
            assert!(value.is_object());
        }

        for descriptor in all_snapshot_descriptors() {
            assert!(descriptor.is_object());
        }
    }
}
