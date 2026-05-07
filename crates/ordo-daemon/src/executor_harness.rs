use crate::redaction::redact_sensitive_values;
use crate::runway_fixtures::{FixtureJobEvent, NODE_JOB_EVENT_JSON_FIXTURE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const EXECUTOR_HARNESS_SCHEMA_VERSION: &str = "1";
pub const EXECUTOR_HARNESS_MODE: &str = "pre_integration_runway";

pub const EXECUTOR_REQUEST_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "requestId": "exec_req_fixture_001",
  "jobId": "job_fixture_001",
  "conversationId": "conv_fixture_001",
  "toolName": "generate_chart",
  "eventType": "progress",
  "requestedAt": "2026-05-07T16:00:00.000Z",
  "input": {
    "progressPercent": 42,
    "progressLabel": "Rendering preview",
    "summary": "Preview render in progress."
  },
  "context": {
    "mode": "pre_integration_runway",
    "attempt": 1,
    "authorization": "Bearer raw-executor-token",
    "cookie": "ordo_session=raw-executor-cookie",
    "provider": {
      "apiKey": "sk-executor-fixture",
      "privateKey": "private-executor-fixture"
    },
    "workPath": "/Users/example/.ordo/executor-work"
  }
}
"#;

pub const EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE: &str = r#"
{
    "schemaVersion": "1",
    "requestId": "exec_req_fixture_canceled",
    "jobId": "job_fixture_canceled",
    "conversationId": "conv_fixture_001",
    "eventType": "canceled",
    "status": "canceled",
    "failureClass": "canceled",
    "timestamp": "2026-05-07T16:10:00.000Z",
    "output": {
        "summary": "Synthetic native cancellation proof only.",
        "context": {
            "authorization": "Bearer raw-cancel-token",
            "cookie": "ordo_session=raw-cancel-cookie",
            "workPath": "/Users/example/.ordo/canceled-executor"
        }
    }
}
"#;

pub const EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE: &str = r#"
{
    "schemaVersion": "1",
    "requestId": "exec_req_fixture_timeout",
    "jobId": "job_fixture_timeout",
    "conversationId": "conv_fixture_001",
    "eventType": "failed",
    "status": "failed",
    "failureClass": "transient",
    "timestamp": "2026-05-07T16:11:00.000Z",
    "output": {
        "errorCode": "executor_timeout",
        "errorMessage": "Synthetic native timeout proof only.",
        "context": {
            "apiKey": "sk-timeout-fixture",
            "privateKey": "private-timeout-fixture",
            "logPath": "/Users/example/.ordo/timeout-executor.log"
        }
    }
}
"#;

pub const EXECUTOR_MALFORMED_RESPONSE_JSON_FIXTURE: &str = r#"
{
    "schemaVersion": "1",
    "requestId": "exec_req_fixture_malformed",
    "jobId": "job_fixture_malformed",
    "eventType": "failed",
"#;

pub const EXECUTOR_UNSUPPORTED_SCHEMA_RESPONSE_JSON_FIXTURE: &str = r#"
{
    "schemaVersion": "2",
    "requestId": "exec_req_fixture_version",
    "jobId": "job_fixture_version",
    "conversationId": "conv_fixture_001",
    "eventType": "failed",
    "status": "failed",
    "failureClass": "transient",
    "timestamp": "2026-05-07T16:20:00.000Z",
    "output": {
        "errorMessage": "Synthetic unsupported schema proof only."
    }
}
"#;

pub const EXECUTOR_MISSING_FIELD_RESPONSE_JSON_FIXTURE: &str = r#"
{
    "schemaVersion": "1",
    "requestId": "exec_req_fixture_missing",
    "conversationId": "conv_fixture_001",
    "eventType": "failed",
    "status": "failed",
    "failureClass": "transient",
    "timestamp": "2026-05-07T16:21:00.000Z",
    "output": {
        "errorMessage": "Synthetic missing field proof only."
    }
}
"#;

pub const EXECUTOR_UNKNOWN_STATUS_RESPONSE_JSON_FIXTURE: &str = r#"
{
    "schemaVersion": "1",
    "requestId": "exec_req_fixture_unknown_status",
    "jobId": "job_fixture_unknown_status",
    "conversationId": "conv_fixture_001",
    "eventType": "failed",
    "status": "paused",
    "failureClass": "unknown",
    "timestamp": "2026-05-07T16:22:00.000Z",
    "output": {
        "errorMessage": "Synthetic unknown status proof only."
    }
}
"#;

pub const EXECUTOR_UNKNOWN_EVENT_TYPE_RESPONSE_JSON_FIXTURE: &str = r#"
{
    "schemaVersion": "1",
    "requestId": "exec_req_fixture_unknown_event",
    "jobId": "job_fixture_unknown_event",
    "conversationId": "conv_fixture_001",
    "eventType": "worker_lost",
    "status": "failed",
    "failureClass": "unknown",
    "timestamp": "2026-05-07T16:23:00.000Z",
    "output": {
        "errorMessage": "Synthetic unknown event type proof only."
    }
}
"#;

const EXECUTOR_RESPONSE_REQUIRED_FIELDS: [&str; 8] = [
    "schemaVersion",
    "requestId",
    "jobId",
    "conversationId",
    "eventType",
    "status",
    "timestamp",
    "output",
];

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorHarnessRequest {
    pub schema_version: String,
    pub request_id: String,
    pub job_id: String,
    pub conversation_id: String,
    pub tool_name: String,
    pub event_type: String,
    pub requested_at: String,
    pub input: Value,
    #[serde(default)]
    pub context: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutorHarnessResponse {
    pub schema_version: String,
    pub request_id: String,
    pub job_id: String,
    pub conversation_id: String,
    pub event_type: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure_class: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_label: Option<String>,
    pub timestamp: String,
    pub output: Value,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExecutorOutcomeClassification {
    Progress,
    Succeeded,
    Failed,
    Canceled,
    Timeout,
    Unknown,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExecutorContractValidationClassification {
    Valid,
    MalformedJson,
    UnsupportedSchemaVersion,
    MissingRequiredField,
    UnknownStatus,
    UnknownEventType,
}

pub fn parse_executor_request_fixture(
    json_fixture: &str,
) -> serde_json::Result<ExecutorHarnessRequest> {
    serde_json::from_str(json_fixture)
}

pub fn parse_executor_response_fixture(
    json_fixture: &str,
) -> serde_json::Result<ExecutorHarnessResponse> {
    serde_json::from_str(json_fixture)
}

pub fn request_from_job_event_fixture() -> serde_json::Result<ExecutorHarnessRequest> {
    let event: FixtureJobEvent = serde_json::from_str(NODE_JOB_EVENT_JSON_FIXTURE)?;
    Ok(ExecutorHarnessRequest {
        schema_version: EXECUTOR_HARNESS_SCHEMA_VERSION.to_string(),
        request_id: "exec_req_from_job_event_fixture".to_string(),
        job_id: event.job_id,
        conversation_id: event.conversation_id,
        tool_name: "generate_chart".to_string(),
        event_type: event.event_type,
        requested_at: event.created_at,
        input: event.payload,
        context: json!({ "mode": EXECUTOR_HARNESS_MODE, "attempt": 1 }),
    })
}

impl ExecutorHarnessResponse {
    pub fn progress(request: &ExecutorHarnessRequest) -> Self {
        Self {
            schema_version: EXECUTOR_HARNESS_SCHEMA_VERSION.to_string(),
            request_id: request.request_id.clone(),
            job_id: request.job_id.clone(),
            conversation_id: request.conversation_id.clone(),
            event_type: "progress".to_string(),
            status: "running".to_string(),
            failure_class: None,
            progress_percent: Some(read_progress_percent(request).unwrap_or(42)),
            progress_label: Some(
                read_progress_label(request).unwrap_or("Rendering preview".to_string()),
            ),
            timestamp: "2026-05-07T16:00:01.000Z".to_string(),
            output: json!({
                "summary": "Synthetic native progress proof only.",
                "executionMode": "dormant_fixture"
            }),
        }
    }

    pub fn succeeded(request: &ExecutorHarnessRequest) -> Self {
        Self {
            schema_version: EXECUTOR_HARNESS_SCHEMA_VERSION.to_string(),
            request_id: request.request_id.clone(),
            job_id: request.job_id.clone(),
            conversation_id: request.conversation_id.clone(),
            event_type: "result".to_string(),
            status: "succeeded".to_string(),
            failure_class: None,
            progress_percent: Some(100),
            progress_label: Some("Synthetic execution complete".to_string()),
            timestamp: "2026-05-07T16:00:02.000Z".to_string(),
            output: json!({
                "summary": "Synthetic native success proof only.",
                "artifactRefs": []
            }),
        }
    }

    pub fn failed(request: &ExecutorHarnessRequest, failure_class: impl Into<String>) -> Self {
        Self {
            schema_version: EXECUTOR_HARNESS_SCHEMA_VERSION.to_string(),
            request_id: request.request_id.clone(),
            job_id: request.job_id.clone(),
            conversation_id: request.conversation_id.clone(),
            event_type: "failed".to_string(),
            status: "failed".to_string(),
            failure_class: Some(failure_class.into()),
            progress_percent: None,
            progress_label: None,
            timestamp: "2026-05-07T16:00:03.000Z".to_string(),
            output: json!({
                "errorMessage": "Synthetic native failure proof only.",
                "recoveryMode": "rerun"
            }),
        }
    }

    pub fn canceled(request: &ExecutorHarnessRequest) -> Self {
        Self {
            schema_version: EXECUTOR_HARNESS_SCHEMA_VERSION.to_string(),
            request_id: request.request_id.clone(),
            job_id: request.job_id.clone(),
            conversation_id: request.conversation_id.clone(),
            event_type: "canceled".to_string(),
            status: "canceled".to_string(),
            failure_class: Some("canceled".to_string()),
            progress_percent: None,
            progress_label: None,
            timestamp: "2026-05-07T16:00:04.000Z".to_string(),
            output: json!({
                "summary": "Synthetic native cancellation proof only."
            }),
        }
    }

    pub fn timed_out(request: &ExecutorHarnessRequest) -> Self {
        Self {
            schema_version: EXECUTOR_HARNESS_SCHEMA_VERSION.to_string(),
            request_id: request.request_id.clone(),
            job_id: request.job_id.clone(),
            conversation_id: request.conversation_id.clone(),
            event_type: "failed".to_string(),
            status: "failed".to_string(),
            failure_class: Some("transient".to_string()),
            progress_percent: None,
            progress_label: None,
            timestamp: "2026-05-07T16:00:05.000Z".to_string(),
            output: json!({
                "errorCode": "executor_timeout",
                "errorMessage": "Synthetic native timeout proof only.",
                "recoveryMode": "rerun"
            }),
        }
    }

    pub fn to_value(&self) -> Value {
        serde_json::to_value(self).unwrap_or_else(|_| json!({}))
    }
}

pub fn exposed_executor_request_json(
    request: &ExecutorHarnessRequest,
) -> serde_json::Result<Value> {
    let raw_request = serde_json::to_value(request)?;
    Ok(redact_sensitive_values(&raw_request).value)
}

pub fn exposed_executor_response_json(
    response: &ExecutorHarnessResponse,
) -> serde_json::Result<Value> {
    let raw_response = response.to_value();
    Ok(redact_sensitive_values(&raw_response).value)
}

pub fn classify_executor_outcome(
    response: &ExecutorHarnessResponse,
) -> ExecutorOutcomeClassification {
    if response.event_type == "canceled"
        || response.status == "canceled"
        || response.failure_class.as_deref() == Some("canceled")
    {
        return ExecutorOutcomeClassification::Canceled;
    }

    let error_code = response
        .output
        .get("errorCode")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    let error_message = response
        .output
        .get("errorMessage")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();

    if response.status == "failed"
        && (error_code.contains("timeout") || error_message.contains("timeout"))
    {
        return ExecutorOutcomeClassification::Timeout;
    }

    match response.status.as_str() {
        "running" => ExecutorOutcomeClassification::Progress,
        "succeeded" => ExecutorOutcomeClassification::Succeeded,
        "failed" => ExecutorOutcomeClassification::Failed,
        _ => ExecutorOutcomeClassification::Unknown,
    }
}

pub fn classify_executor_response_contract(
    json_fixture: &str,
) -> ExecutorContractValidationClassification {
    let Ok(value) = serde_json::from_str::<Value>(json_fixture) else {
        return ExecutorContractValidationClassification::MalformedJson;
    };

    let Some(response) = value.as_object() else {
        return ExecutorContractValidationClassification::MissingRequiredField;
    };

    for required_field in EXECUTOR_RESPONSE_REQUIRED_FIELDS {
        if !response.contains_key(required_field) {
            return ExecutorContractValidationClassification::MissingRequiredField;
        }
    }

    if value["schemaVersion"] != EXECUTOR_HARNESS_SCHEMA_VERSION {
        return ExecutorContractValidationClassification::UnsupportedSchemaVersion;
    }

    let Some(event_type) = value["eventType"].as_str() else {
        return ExecutorContractValidationClassification::UnknownEventType;
    };
    if !is_known_executor_event_type(event_type) {
        return ExecutorContractValidationClassification::UnknownEventType;
    }

    let Some(status) = value["status"].as_str() else {
        return ExecutorContractValidationClassification::UnknownStatus;
    };
    if !is_known_executor_status(status) {
        return ExecutorContractValidationClassification::UnknownStatus;
    }

    ExecutorContractValidationClassification::Valid
}

pub fn exposed_executor_contract_validation_json(json_fixture: &str) -> Value {
    let classification = classify_executor_response_contract(json_fixture);
    let redacted_value = serde_json::from_str::<Value>(json_fixture)
        .ok()
        .map(|value| redact_sensitive_values(&value).value)
        .unwrap_or(Value::Null);

    json!({
        "schemaVersion": EXECUTOR_HARNESS_SCHEMA_VERSION,
        "classification": classification,
        "redactedValue": redacted_value
    })
}

fn is_known_executor_event_type(event_type: &str) -> bool {
    matches!(event_type, "progress" | "result" | "failed" | "canceled")
}

fn is_known_executor_status(status: &str) -> bool {
    matches!(status, "running" | "succeeded" | "failed" | "canceled")
}

fn read_progress_percent(request: &ExecutorHarnessRequest) -> Option<u8> {
    request
        .input
        .get("progressPercent")
        .and_then(Value::as_u64)
        .and_then(|value| u8::try_from(value).ok())
}

fn read_progress_label(request: &ExecutorHarnessRequest) -> Option<String> {
    request
        .input
        .get("progressLabel")
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::redaction::REDACTED_VALUE;

    fn assert_no_raw_sensitive_values(value: &Value) {
        let serialized = serde_json::to_string(value).unwrap();
        assert_serialized_has_no_raw_sensitive_values(&serialized);
    }

    fn assert_serialized_has_no_raw_sensitive_values(serialized: &str) {
        for forbidden in [
            "raw-executor-token",
            "raw-executor-cookie",
            "raw-cancel-token",
            "raw-cancel-cookie",
            "sk-executor-fixture",
            "sk-timeout-fixture",
            "private-executor-fixture",
            "private-timeout-fixture",
            "/Users/example",
            "raw-invalid-token",
            "sk-invalid-fixture",
        ] {
            assert!(
                !serialized.contains(forbidden),
                "exposed executor JSON should not contain raw sensitive value: {forbidden}"
            );
        }
    }

    #[test]
    fn executor_request_fixture_parses_deterministically() {
        let first = parse_executor_request_fixture(EXECUTOR_REQUEST_JSON_FIXTURE).unwrap();
        let second = parse_executor_request_fixture(EXECUTOR_REQUEST_JSON_FIXTURE).unwrap();

        assert_eq!(first, second);
        assert_eq!(first.schema_version, EXECUTOR_HARNESS_SCHEMA_VERSION);
        assert_eq!(first.request_id, "exec_req_fixture_001");
        assert_eq!(first.job_id, "job_fixture_001");
        assert_eq!(first.conversation_id, "conv_fixture_001");
        assert_eq!(first.event_type, "progress");
        assert_eq!(first.input["progressPercent"], 42);
    }

    #[test]
    fn request_can_be_derived_from_existing_job_event_fixture() {
        let request = request_from_job_event_fixture().unwrap();

        assert_eq!(request.job_id, "job_fixture_001");
        assert_eq!(request.conversation_id, "conv_fixture_001");
        assert_eq!(request.event_type, "progress");
        assert_eq!(request.requested_at, "2026-05-06T12:00:00.000Z");
        assert_eq!(request.input["progressLabel"], "Rendering preview");
    }

    #[test]
    fn synthetic_response_json_is_stable_and_camel_case() {
        let request = request_from_job_event_fixture().unwrap();
        let first =
            serde_json::to_string_pretty(&ExecutorHarnessResponse::progress(&request).to_value())
                .unwrap();
        let second =
            serde_json::to_string_pretty(&ExecutorHarnessResponse::progress(&request).to_value())
                .unwrap();

        assert_eq!(first, second);
        assert!(first.contains("schemaVersion"));
        assert!(first.contains("requestId"));
        assert!(first.contains("jobId"));
        assert!(!first.contains("schema_version"));
        assert!(!first.contains("request_id"));
    }

    #[test]
    fn progress_success_and_failure_preserve_safe_job_fields() {
        let request = request_from_job_event_fixture().unwrap();
        let progress = ExecutorHarnessResponse::progress(&request).to_value();
        let success = ExecutorHarnessResponse::succeeded(&request).to_value();
        let failure = ExecutorHarnessResponse::failed(&request, "transient").to_value();

        assert_eq!(progress["jobId"], "job_fixture_001");
        assert_eq!(progress["conversationId"], "conv_fixture_001");
        assert_eq!(progress["eventType"], "progress");
        assert_eq!(progress["progressPercent"], 42);
        assert_eq!(progress["progressLabel"], "Rendering preview");
        assert_eq!(progress["timestamp"], "2026-05-07T16:00:01.000Z");

        assert_eq!(success["eventType"], "result");
        assert_eq!(success["status"], "succeeded");
        assert_eq!(success["progressPercent"], 100);

        assert_eq!(failure["eventType"], "failed");
        assert_eq!(failure["status"], "failed");
        assert_eq!(failure["failureClass"], "transient");
    }

    #[test]
    fn cancellation_and_timeout_fixtures_parse_deterministically() {
        let canceled_first =
            parse_executor_response_fixture(EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE).unwrap();
        let canceled_second =
            parse_executor_response_fixture(EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE).unwrap();
        let timeout_first =
            parse_executor_response_fixture(EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE).unwrap();
        let timeout_second =
            parse_executor_response_fixture(EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE).unwrap();

        assert_eq!(canceled_first, canceled_second);
        assert_eq!(timeout_first, timeout_second);
        assert_eq!(
            canceled_first.schema_version,
            EXECUTOR_HARNESS_SCHEMA_VERSION
        );
        assert_eq!(canceled_first.event_type, "canceled");
        assert_eq!(canceled_first.status, "canceled");
        assert_eq!(canceled_first.failure_class.as_deref(), Some("canceled"));
        assert_eq!(timeout_first.event_type, "failed");
        assert_eq!(timeout_first.status, "failed");
        assert_eq!(timeout_first.failure_class.as_deref(), Some("transient"));
    }

    #[test]
    fn classification_is_stable_for_executor_outcomes() {
        let request = request_from_job_event_fixture().unwrap();
        let cases = [
            (
                ExecutorHarnessResponse::progress(&request),
                ExecutorOutcomeClassification::Progress,
            ),
            (
                ExecutorHarnessResponse::succeeded(&request),
                ExecutorOutcomeClassification::Succeeded,
            ),
            (
                ExecutorHarnessResponse::failed(&request, "transient"),
                ExecutorOutcomeClassification::Failed,
            ),
            (
                ExecutorHarnessResponse::canceled(&request),
                ExecutorOutcomeClassification::Canceled,
            ),
            (
                ExecutorHarnessResponse::timed_out(&request),
                ExecutorOutcomeClassification::Timeout,
            ),
            (
                parse_executor_response_fixture(EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE).unwrap(),
                ExecutorOutcomeClassification::Canceled,
            ),
            (
                parse_executor_response_fixture(EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE).unwrap(),
                ExecutorOutcomeClassification::Timeout,
            ),
        ];

        for (response, expected) in cases {
            assert_eq!(classify_executor_outcome(&response), expected);
        }
    }

    #[test]
    fn canceled_and_timeout_fixtures_preserve_safe_job_fields() {
        let canceled =
            parse_executor_response_fixture(EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE).unwrap();
        let timeout =
            parse_executor_response_fixture(EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE).unwrap();
        let canceled_json = canceled.to_value();
        let timeout_json = timeout.to_value();

        assert_eq!(canceled_json["jobId"], "job_fixture_canceled");
        assert_eq!(canceled_json["conversationId"], "conv_fixture_001");
        assert_eq!(canceled_json["eventType"], "canceled");
        assert_eq!(canceled_json["status"], "canceled");
        assert_eq!(canceled_json["failureClass"], "canceled");
        assert_eq!(canceled_json["timestamp"], "2026-05-07T16:10:00.000Z");

        assert_eq!(timeout_json["jobId"], "job_fixture_timeout");
        assert_eq!(timeout_json["conversationId"], "conv_fixture_001");
        assert_eq!(timeout_json["eventType"], "failed");
        assert_eq!(timeout_json["status"], "failed");
        assert_eq!(timeout_json["failureClass"], "transient");
        assert_eq!(timeout_json["timestamp"], "2026-05-07T16:11:00.000Z");
    }

    #[test]
    fn cancellation_and_timeout_contexts_are_redacted_before_exposure() {
        let canceled =
            parse_executor_response_fixture(EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE).unwrap();
        let timeout =
            parse_executor_response_fixture(EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE).unwrap();
        let exposed_canceled = exposed_executor_response_json(&canceled).unwrap();
        let exposed_timeout = exposed_executor_response_json(&timeout).unwrap();

        assert_eq!(
            exposed_canceled["output"]["context"]["authorization"],
            REDACTED_VALUE
        );
        assert_eq!(
            exposed_canceled["output"]["context"]["cookie"],
            REDACTED_VALUE
        );
        assert_eq!(
            exposed_canceled["output"]["context"]["workPath"],
            REDACTED_VALUE
        );
        assert_eq!(
            exposed_timeout["output"]["context"]["apiKey"],
            REDACTED_VALUE
        );
        assert_eq!(
            exposed_timeout["output"]["context"]["privateKey"],
            REDACTED_VALUE
        );
        assert_eq!(
            exposed_timeout["output"]["context"]["logPath"],
            REDACTED_VALUE
        );
        assert_eq!(exposed_canceled["jobId"], "job_fixture_canceled");
        assert_eq!(exposed_timeout["jobId"], "job_fixture_timeout");
        assert_no_raw_sensitive_values(&exposed_canceled);
        assert_no_raw_sensitive_values(&exposed_timeout);
    }

    #[test]
    fn sensitive_request_context_is_redacted_before_exposure() {
        let request = parse_executor_request_fixture(EXECUTOR_REQUEST_JSON_FIXTURE).unwrap();
        let exposed = exposed_executor_request_json(&request).unwrap();

        assert_eq!(exposed["context"]["authorization"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["cookie"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["provider"]["apiKey"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["provider"]["privateKey"], REDACTED_VALUE);
        assert_eq!(exposed["context"]["workPath"], REDACTED_VALUE);
        assert_eq!(exposed["jobId"], "job_fixture_001");
        assert_eq!(exposed["conversationId"], "conv_fixture_001");
        assert_no_raw_sensitive_values(&exposed);
    }

    #[test]
    fn exposed_responses_do_not_leak_sensitive_values() {
        let request = parse_executor_request_fixture(EXECUTOR_REQUEST_JSON_FIXTURE).unwrap();
        let responses = [
            ExecutorHarnessResponse::progress(&request),
            ExecutorHarnessResponse::succeeded(&request),
            ExecutorHarnessResponse::failed(&request, "transient"),
            ExecutorHarnessResponse::canceled(&request),
            ExecutorHarnessResponse::timed_out(&request),
        ];

        for response in responses {
            let exposed = exposed_executor_response_json(&response).unwrap();
            assert_no_raw_sensitive_values(&exposed);
            assert_eq!(exposed["jobId"], "job_fixture_001");
            assert_eq!(exposed["conversationId"], "conv_fixture_001");
        }
    }

    #[test]
    fn invalid_output_fixtures_classify_deterministically_without_panics() {
        let cases = [
            (
                EXECUTOR_MALFORMED_RESPONSE_JSON_FIXTURE,
                ExecutorContractValidationClassification::MalformedJson,
            ),
            (
                EXECUTOR_UNSUPPORTED_SCHEMA_RESPONSE_JSON_FIXTURE,
                ExecutorContractValidationClassification::UnsupportedSchemaVersion,
            ),
            (
                EXECUTOR_MISSING_FIELD_RESPONSE_JSON_FIXTURE,
                ExecutorContractValidationClassification::MissingRequiredField,
            ),
            (
                EXECUTOR_UNKNOWN_STATUS_RESPONSE_JSON_FIXTURE,
                ExecutorContractValidationClassification::UnknownStatus,
            ),
            (
                EXECUTOR_UNKNOWN_EVENT_TYPE_RESPONSE_JSON_FIXTURE,
                ExecutorContractValidationClassification::UnknownEventType,
            ),
        ];

        for (fixture, expected) in cases {
            assert_eq!(classify_executor_response_contract(fixture), expected);
            assert_eq!(classify_executor_response_contract(fixture), expected);
        }
    }

    #[test]
    fn known_valid_executor_responses_classify_as_valid_contracts() {
        let request = parse_executor_request_fixture(EXECUTOR_REQUEST_JSON_FIXTURE).unwrap();
        let constructed_responses = [
            ExecutorHarnessResponse::progress(&request),
            ExecutorHarnessResponse::succeeded(&request),
            ExecutorHarnessResponse::failed(&request, "transient"),
            ExecutorHarnessResponse::canceled(&request),
            ExecutorHarnessResponse::timed_out(&request),
        ];

        for response in constructed_responses {
            let json_fixture = serde_json::to_string(&response).unwrap();
            assert_eq!(
                classify_executor_response_contract(&json_fixture),
                ExecutorContractValidationClassification::Valid
            );
        }

        for fixture in [
            EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE,
            EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE,
        ] {
            assert_eq!(
                classify_executor_response_contract(fixture),
                ExecutorContractValidationClassification::Valid
            );
        }
    }

    #[test]
    fn exposed_contract_validation_json_is_camel_case_and_safe() {
        let exposed = exposed_executor_contract_validation_json(
            EXECUTOR_UNSUPPORTED_SCHEMA_RESPONSE_JSON_FIXTURE,
        );
        let malformed =
            exposed_executor_contract_validation_json(EXECUTOR_MALFORMED_RESPONSE_JSON_FIXTURE);
        let serialized = serde_json::to_string(&exposed).unwrap();

        assert_eq!(exposed["schemaVersion"], EXECUTOR_HARNESS_SCHEMA_VERSION);
        assert_eq!(exposed["classification"], "unsupported_schema_version");
        assert_eq!(malformed["classification"], "malformed_json");
        assert_eq!(malformed["redactedValue"], Value::Null);
        assert!(serialized.contains("redactedValue"));
        assert!(!serialized.contains("redacted_value"));
        assert_no_raw_sensitive_values(&exposed);
        assert_no_raw_sensitive_values(&malformed);
    }

    #[test]
    fn invalid_output_fixtures_do_not_include_raw_sensitive_values() {
        for fixture in [
            EXECUTOR_MALFORMED_RESPONSE_JSON_FIXTURE,
            EXECUTOR_UNSUPPORTED_SCHEMA_RESPONSE_JSON_FIXTURE,
            EXECUTOR_MISSING_FIELD_RESPONSE_JSON_FIXTURE,
            EXECUTOR_UNKNOWN_STATUS_RESPONSE_JSON_FIXTURE,
            EXECUTOR_UNKNOWN_EVENT_TYPE_RESPONSE_JSON_FIXTURE,
        ] {
            assert_serialized_has_no_raw_sensitive_values(fixture);
            let exposed = exposed_executor_contract_validation_json(fixture);
            assert_no_raw_sensitive_values(&exposed);
        }
    }
}
