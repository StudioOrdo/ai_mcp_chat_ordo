use serde_json::{json, Value};

pub const SNAPSHOT_SCHEMA_VERSION: &str = "1";
pub const SNAPSHOT_RUNTIME_MODE: &str = "pre_integration_runway";

pub fn health_snapshot_descriptor() -> Value {
    json!({
        "schemaVersion": SNAPSHOT_SCHEMA_VERSION,
        "runtimeMode": SNAPSHOT_RUNTIME_MODE,
        "contract": "ordo-daemon.health",
        "sourceOfTruth": ["crates/ordo-daemon/src/health.rs", "src/lib/health/probes.ts"],
        "fixture": "DAEMON_HEALTH_JSON_FIXTURE",
        "requiredFields": [
            "schemaVersion",
            "service",
            "version",
            "status",
            "mode",
            "subsystems",
            "notes"
        ],
        "fieldTypes": {
            "schemaVersion": "string",
            "service": "string",
            "version": "string",
            "status": "string",
            "mode": "string",
            "subsystems": "record<string, { enabled: boolean, state: string }>",
            "notes": "string[]"
        },
        "allowedValues": {
            "status": ["ok"],
            "mode": [SNAPSHOT_RUNTIME_MODE],
            "subsystems.*.enabled": [false],
            "subsystems.*.state": ["disabled"]
        }
    })
}

pub fn readiness_snapshot_descriptor() -> Value {
    json!({
        "schemaVersion": SNAPSHOT_SCHEMA_VERSION,
        "runtimeMode": SNAPSHOT_RUNTIME_MODE,
        "contract": "ordo-daemon.readiness",
        "sourceOfTruth": ["crates/ordo-daemon/src/health.rs", "src/lib/health/probes.ts"],
        "fixture": "DAEMON_READINESS_JSON_FIXTURE",
        "sameShapeAs": "ordo-daemon.health",
        "requiredFields": [
            "schemaVersion",
            "service",
            "version",
            "status",
            "mode",
            "subsystems",
            "notes"
        ]
    })
}

pub fn job_event_snapshot_descriptor() -> Value {
    json!({
        "schemaVersion": SNAPSHOT_SCHEMA_VERSION,
        "runtimeMode": SNAPSHOT_RUNTIME_MODE,
        "contract": "node.jobEvent.fixture",
        "sourceOfTruth": ["src/core/entities/job.ts"],
        "fixture": "NODE_JOB_EVENT_JSON_FIXTURE",
        "requiredFields": [
            "id",
            "jobId",
            "conversationId",
            "sequence",
            "eventType",
            "payload",
            "createdAt"
        ],
        "fieldTypes": {
            "id": "string",
            "jobId": "string",
            "conversationId": "string",
            "sequence": "number",
            "eventType": "JobEventType",
            "payload": "record<string, unknown>",
            "createdAt": "string"
        },
        "allowedValues": {
            "eventType": ["progress"]
        }
    })
}

pub fn job_progress_stream_snapshot_descriptor() -> Value {
    json!({
        "schemaVersion": SNAPSHOT_SCHEMA_VERSION,
        "runtimeMode": SNAPSHOT_RUNTIME_MODE,
        "contract": "node.jobProgressStream.fixture",
        "sourceOfTruth": [
            "src/lib/jobs/job-event-stream.ts",
            "src/lib/jobs/job-publication.ts",
            "src/lib/jobs/job-status-snapshots.ts",
            "src/core/entities/message-parts.ts",
            "src/core/entities/chat-stream.ts"
        ],
        "fixture": "NODE_JOB_STREAM_EVENT_JSON_FIXTURE",
        "requiredFields": [
            "type",
            "messageId",
            "jobId",
            "conversationId",
            "sequence",
            "toolName",
            "label",
            "progressPercent",
            "progressLabel",
            "part"
        ],
        "fieldTypes": {
            "type": "job_progress",
            "messageId": "string",
            "jobId": "string",
            "conversationId": "string",
            "sequence": "number",
            "toolName": "string",
            "label": "string",
            "title": "string?",
            "subtitle": "string?",
            "progressPercent": "number?",
            "progressLabel": "string?",
            "updatedAt": "string?",
            "part": "JobStatusMessagePart"
        },
        "nestedRequiredFields": {
            "part": [
                "type",
                "jobId",
                "toolName",
                "label",
                "status",
                "sequence",
                "progressPercent",
                "progressLabel"
            ]
        },
        "allowedValues": {
            "type": ["job_progress"],
            "part.type": ["job_status"],
            "part.status": ["running"]
        }
    })
}

pub fn all_snapshot_descriptors() -> Vec<Value> {
    vec![
        health_snapshot_descriptor(),
        readiness_snapshot_descriptor(),
        job_event_snapshot_descriptor(),
        job_progress_stream_snapshot_descriptor(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health::{DISABLED_SUBSYSTEM_NAMES, PRE_INTEGRATION_MODE};
    use crate::runway_fixtures::{
        DAEMON_HEALTH_JSON_FIXTURE, DAEMON_READINESS_JSON_FIXTURE, NODE_JOB_EVENT_JSON_FIXTURE,
        NODE_JOB_STREAM_EVENT_JSON_FIXTURE,
    };
    use std::collections::BTreeSet;

    const SENSITIVE_SNAPSHOT_TERMS: [&str; 14] = [
        "apikey",
        "api_key",
        "authorization",
        "cookie",
        "credential",
        "database",
        "password",
        "privatekey",
        "private_key",
        "secret",
        "session",
        "sqlite",
        "token",
        "users/",
    ];

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
                    .expect("required field names should be strings")
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

    fn assert_snapshot_is_safe(snapshot: &Value) {
        let normalized = serde_json::to_string(snapshot)
            .unwrap()
            .to_ascii_lowercase();
        for term in SENSITIVE_SNAPSHOT_TERMS {
            assert!(
                !normalized.contains(term),
                "schema snapshot should not include sensitive term: {term}"
            );
        }
    }

    #[test]
    fn snapshot_descriptors_are_deterministic_json() {
        let first = serde_json::to_string_pretty(&all_snapshot_descriptors()).unwrap();
        let second = serde_json::to_string_pretty(&all_snapshot_descriptors()).unwrap();
        assert_eq!(first, second);
        assert!(first.contains("node.jobProgressStream.fixture"));
        assert!(first.contains("src/core/entities/job.ts"));
    }

    #[test]
    fn health_snapshot_descriptors_match_dormant_fixtures() {
        let health: Value = serde_json::from_str(DAEMON_HEALTH_JSON_FIXTURE).unwrap();
        let readiness: Value = serde_json::from_str(DAEMON_READINESS_JSON_FIXTURE).unwrap();

        assert_required_fields_are_present(&health_snapshot_descriptor(), &health);
        assert_required_fields_are_present(&readiness_snapshot_descriptor(), &readiness);
        assert_eq!(health["mode"], PRE_INTEGRATION_MODE);
        assert_eq!(readiness["mode"], PRE_INTEGRATION_MODE);

        for name in DISABLED_SUBSYSTEM_NAMES {
            assert_eq!(health["subsystems"][name]["enabled"], false);
            assert_eq!(health["subsystems"][name]["state"], "disabled");
            assert_eq!(readiness["subsystems"][name]["enabled"], false);
            assert_eq!(readiness["subsystems"][name]["state"], "disabled");
        }
    }

    #[test]
    fn job_event_snapshot_descriptor_matches_fixture_fields() {
        let fixture: Value = serde_json::from_str(NODE_JOB_EVENT_JSON_FIXTURE).unwrap();
        let descriptor = job_event_snapshot_descriptor();

        assert_required_fields_are_present(&descriptor, &fixture);
        assert_eq!(fixture["eventType"], "progress");
        assert_eq!(fixture["payload"]["progressPercent"], 42);
        assert_eq!(descriptor["fieldTypes"]["eventType"], "JobEventType");
    }

    #[test]
    fn job_progress_stream_snapshot_descriptor_matches_fixture_fields() {
        let fixture: Value = serde_json::from_str(NODE_JOB_STREAM_EVENT_JSON_FIXTURE).unwrap();
        let descriptor = job_progress_stream_snapshot_descriptor();

        assert_required_fields_are_present(&descriptor, &fixture);
        assert_eq!(fixture["type"], "job_progress");
        assert_eq!(fixture["part"]["type"], "job_status");
        assert_eq!(fixture["part"]["status"], "running");
        assert_eq!(fixture["jobId"], fixture["part"]["jobId"]);
        assert_eq!(fixture["sequence"], fixture["part"]["sequence"]);
        assert_eq!(descriptor["fieldTypes"]["part"], "JobStatusMessagePart");
    }

    #[test]
    fn schema_snapshots_do_not_include_sensitive_terms() {
        for snapshot in all_snapshot_descriptors() {
            assert_snapshot_is_safe(&snapshot);
        }
    }
}
