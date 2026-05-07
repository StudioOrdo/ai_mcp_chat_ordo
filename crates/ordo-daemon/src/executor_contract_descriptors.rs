use serde_json::{json, Value};

pub const EXECUTOR_DESCRIPTOR_SCHEMA_VERSION: &str = "1";
pub const EXECUTOR_DESCRIPTOR_RUNTIME_MODE: &str = "pre_integration_runway";

const SOURCE_OF_TRUTH: [&str; 4] = [
    "crates/ordo-daemon/src/executor_harness.rs",
    "src/core/entities/job.ts",
    "src/lib/jobs/job-publication.ts",
    "src/lib/jobs/job-status-snapshots.ts",
];

pub fn executor_request_descriptor() -> Value {
    json!({
        "schemaVersion": EXECUTOR_DESCRIPTOR_SCHEMA_VERSION,
        "runtimeMode": EXECUTOR_DESCRIPTOR_RUNTIME_MODE,
        "contract": "ordo-daemon.executor.request.fixture",
        "sourceOfTruth": SOURCE_OF_TRUTH,
        "fixture": "EXECUTOR_REQUEST_JSON_FIXTURE",
        "requiredFields": [
            "schemaVersion",
            "requestId",
            "jobId",
            "conversationId",
            "toolName",
            "eventType",
            "requestedAt",
            "input",
            "context"
        ],
        "fieldTypes": {
            "schemaVersion": "string",
            "requestId": "string",
            "jobId": "string",
            "conversationId": "string",
            "toolName": "string",
            "eventType": "JobEventType",
            "requestedAt": "string",
            "input": "record<string, unknown>",
            "context": "record<string, unknown>"
        },
        "allowedValues": {
            "schemaVersion": [EXECUTOR_DESCRIPTOR_SCHEMA_VERSION],
            "eventType": ["progress"],
            "context.mode": [EXECUTOR_DESCRIPTOR_RUNTIME_MODE]
        }
    })
}

pub fn executor_progress_response_descriptor() -> Value {
    executor_response_descriptor(
        "ordo-daemon.executor.response.progress",
        "ExecutorHarnessResponse::progress",
        json!({
            "schemaVersion": [EXECUTOR_DESCRIPTOR_SCHEMA_VERSION],
            "eventType": ["progress"],
            "status": ["running"]
        }),
    )
}

pub fn executor_success_response_descriptor() -> Value {
    executor_response_descriptor(
        "ordo-daemon.executor.response.success",
        "ExecutorHarnessResponse::succeeded",
        json!({
            "schemaVersion": [EXECUTOR_DESCRIPTOR_SCHEMA_VERSION],
            "eventType": ["result"],
            "status": ["succeeded"],
            "progressPercent": [100]
        }),
    )
}

pub fn executor_failed_response_descriptor() -> Value {
    executor_response_descriptor(
        "ordo-daemon.executor.response.failed",
        "ExecutorHarnessResponse::failed",
        json!({
            "schemaVersion": [EXECUTOR_DESCRIPTOR_SCHEMA_VERSION],
            "eventType": ["failed"],
            "status": ["failed"],
            "failureClass": ["transient"]
        }),
    )
}

pub fn executor_canceled_response_descriptor() -> Value {
    executor_response_descriptor(
        "ordo-daemon.executor.response.canceled",
        "EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE",
        json!({
            "schemaVersion": [EXECUTOR_DESCRIPTOR_SCHEMA_VERSION],
            "eventType": ["canceled"],
            "status": ["canceled"],
            "failureClass": ["canceled"]
        }),
    )
}

pub fn executor_timeout_response_descriptor() -> Value {
    executor_response_descriptor(
        "ordo-daemon.executor.response.timeout",
        "EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE",
        json!({
            "schemaVersion": [EXECUTOR_DESCRIPTOR_SCHEMA_VERSION],
            "eventType": ["failed"],
            "status": ["failed"],
            "failureClass": ["transient"],
            "output.errorCode": ["executor_timeout"]
        }),
    )
}

pub fn all_executor_contract_descriptors() -> Vec<Value> {
    vec![
        executor_request_descriptor(),
        executor_progress_response_descriptor(),
        executor_success_response_descriptor(),
        executor_failed_response_descriptor(),
        executor_canceled_response_descriptor(),
        executor_timeout_response_descriptor(),
    ]
}

fn executor_response_descriptor(contract: &str, fixture: &str, allowed_values: Value) -> Value {
    json!({
        "schemaVersion": EXECUTOR_DESCRIPTOR_SCHEMA_VERSION,
        "runtimeMode": EXECUTOR_DESCRIPTOR_RUNTIME_MODE,
        "contract": contract,
        "sourceOfTruth": SOURCE_OF_TRUTH,
        "fixture": fixture,
        "requiredFields": [
            "schemaVersion",
            "requestId",
            "jobId",
            "conversationId",
            "eventType",
            "status",
            "timestamp",
            "output"
        ],
        "fieldTypes": {
            "schemaVersion": "string",
            "requestId": "string",
            "jobId": "string",
            "conversationId": "string",
            "eventType": "JobEventType",
            "status": "JobStatus",
            "failureClass": "JobFailureClass?",
            "progressPercent": "number?",
            "progressLabel": "string?",
            "timestamp": "string",
            "output": "record<string, unknown>"
        },
        "allowedValues": allowed_values
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::executor_harness::{
        parse_executor_request_fixture, parse_executor_response_fixture,
        request_from_job_event_fixture, ExecutorHarnessResponse,
        EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE, EXECUTOR_REQUEST_JSON_FIXTURE,
        EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE,
    };
    use std::collections::BTreeSet;

    const REQUIRED_SOURCE_REFERENCES: [&str; 4] = [
        "crates/ordo-daemon/src/executor_harness.rs",
        "src/core/entities/job.ts",
        "src/lib/jobs/job-publication.ts",
        "src/lib/jobs/job-status-snapshots.ts",
    ];

    const SENSITIVE_DESCRIPTOR_TERMS: [&str; 14] = [
        "apikey",
        "api_key",
        "authorization",
        "cookie",
        "credential",
        "password",
        "privatekey",
        "private_key",
        "secret",
        "session",
        "sqlite",
        "token",
        "users/",
        "bearer",
    ];

    fn request_fixture_value() -> Value {
        serde_json::to_value(parse_executor_request_fixture(EXECUTOR_REQUEST_JSON_FIXTURE).unwrap())
            .unwrap()
    }

    fn progress_response_value() -> Value {
        let request = request_from_job_event_fixture().unwrap();
        ExecutorHarnessResponse::progress(&request).to_value()
    }

    fn success_response_value() -> Value {
        let request = request_from_job_event_fixture().unwrap();
        ExecutorHarnessResponse::succeeded(&request).to_value()
    }

    fn failed_response_value() -> Value {
        let request = request_from_job_event_fixture().unwrap();
        ExecutorHarnessResponse::failed(&request, "transient").to_value()
    }

    fn canceled_response_value() -> Value {
        parse_executor_response_fixture(EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE)
            .unwrap()
            .to_value()
    }

    fn timeout_response_value() -> Value {
        parse_executor_response_fixture(EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE)
            .unwrap()
            .to_value()
    }

    fn field_set(value: &Value) -> BTreeSet<String> {
        value
            .as_object()
            .expect("fixture should be a JSON object")
            .keys()
            .cloned()
            .collect()
    }

    fn required_field_set(descriptor: &Value) -> BTreeSet<String> {
        descriptor["requiredFields"]
            .as_array()
            .expect("descriptor should include requiredFields")
            .iter()
            .map(|field| {
                field
                    .as_str()
                    .expect("field should be a string")
                    .to_string()
            })
            .collect()
    }

    fn assert_required_fields_are_present(descriptor: &Value, fixture: &Value) {
        let available_fields = field_set(fixture);
        for required_field in required_field_set(descriptor) {
            assert!(
                available_fields.contains(&required_field),
                "fixture missing required descriptor field: {required_field}"
            );
        }
    }

    fn assert_allowed_values_match(descriptor: &Value, fixture: &Value) {
        let allowed_values = descriptor["allowedValues"]
            .as_object()
            .expect("descriptor should include allowedValues");

        for (path, allowed) in allowed_values {
            let actual = value_at_path(fixture, path)
                .unwrap_or_else(|| panic!("fixture missing allowed value path: {path}"));
            let allowed_entries = allowed
                .as_array()
                .expect("allowed value entries should be arrays");
            assert!(
                allowed_entries.iter().any(|entry| entry == actual),
                "fixture value at {path} did not match descriptor allowed values"
            );
        }
    }

    fn value_at_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
        path.split('.')
            .try_fold(value, |current, segment| current.get(segment))
    }

    fn assert_sources_are_present(descriptor: &Value) {
        let sources = descriptor["sourceOfTruth"]
            .as_array()
            .expect("descriptor should include sourceOfTruth")
            .iter()
            .filter_map(Value::as_str)
            .collect::<BTreeSet<_>>();

        for source in REQUIRED_SOURCE_REFERENCES {
            assert!(
                sources.contains(source),
                "missing source reference: {source}"
            );
        }
    }

    fn assert_descriptor_is_safe(descriptor: &Value) {
        let normalized = serde_json::to_string(descriptor)
            .unwrap()
            .to_ascii_lowercase();
        for term in SENSITIVE_DESCRIPTOR_TERMS {
            assert!(
                !normalized.contains(term),
                "executor descriptor should not include sensitive term: {term}"
            );
        }
    }

    #[test]
    fn executor_contract_descriptors_are_deterministic_json() {
        let first = serde_json::to_string_pretty(&all_executor_contract_descriptors()).unwrap();
        let second = serde_json::to_string_pretty(&all_executor_contract_descriptors()).unwrap();

        assert_eq!(first, second);
        assert!(first.contains("ordo-daemon.executor.request.fixture"));
        assert!(first.contains("ordo-daemon.executor.response.timeout"));
        assert!(first.contains("src/core/entities/job.ts"));
    }

    #[test]
    fn required_fields_are_present_in_harness_examples() {
        let cases = [
            (executor_request_descriptor(), request_fixture_value()),
            (
                executor_progress_response_descriptor(),
                progress_response_value(),
            ),
            (
                executor_success_response_descriptor(),
                success_response_value(),
            ),
            (
                executor_failed_response_descriptor(),
                failed_response_value(),
            ),
            (
                executor_canceled_response_descriptor(),
                canceled_response_value(),
            ),
            (
                executor_timeout_response_descriptor(),
                timeout_response_value(),
            ),
        ];

        for (descriptor, fixture) in cases {
            assert_required_fields_are_present(&descriptor, &fixture);
        }
    }

    #[test]
    fn allowed_values_match_harness_examples() {
        let cases = [
            (executor_request_descriptor(), request_fixture_value()),
            (
                executor_progress_response_descriptor(),
                progress_response_value(),
            ),
            (
                executor_success_response_descriptor(),
                success_response_value(),
            ),
            (
                executor_failed_response_descriptor(),
                failed_response_value(),
            ),
            (
                executor_canceled_response_descriptor(),
                canceled_response_value(),
            ),
            (
                executor_timeout_response_descriptor(),
                timeout_response_value(),
            ),
        ];

        for (descriptor, fixture) in cases {
            assert_allowed_values_match(&descriptor, &fixture);
        }
    }

    #[test]
    fn source_references_include_rust_harness_and_typescript_contracts() {
        for descriptor in all_executor_contract_descriptors() {
            assert_sources_are_present(&descriptor);
        }
    }

    #[test]
    fn executor_contract_descriptors_do_not_include_sensitive_fixture_values() {
        for descriptor in all_executor_contract_descriptors() {
            assert_descriptor_is_safe(&descriptor);
        }
    }
}
