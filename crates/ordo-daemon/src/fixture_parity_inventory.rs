use serde::Serialize;
use serde_json::{json, Value};

pub const FIXTURE_PARITY_INVENTORY_SCHEMA_VERSION: &str = "1";
pub const FIXTURE_PARITY_INVENTORY_RUNTIME_MODE: &str = "pre_integration_runway";
pub const FIXTURE_PARITY_INVENTORY_GENERATED_SCHEMA_STATUS: &str = "not_generated";
pub const FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING: &str = "none";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FixtureParityInventoryEntry {
    pub surface: &'static str,
    pub source_module: &'static str,
    pub fixture_names: &'static [&'static str],
    pub covered_status_values: &'static [&'static str],
    pub covered_classification_values: &'static [&'static str],
    pub redaction_coverage: &'static [&'static str],
    pub typescript_references: &'static [&'static str],
    pub generated_schema_gaps: &'static [&'static str],
    pub production_wiring: &'static str,
}

pub const FIXTURE_PARITY_INVENTORY: &[FixtureParityInventoryEntry] = &[
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.health",
        source_module: "crates/ordo-daemon/src/health.rs",
        fixture_names: &["DAEMON_HEALTH_JSON_FIXTURE"],
        covered_status_values: &[
            "status:ok",
            "mode:pre_integration_runway",
            "subsystems.*.state:disabled",
        ],
        covered_classification_values: &[],
        redaction_coverage: &["public health JSON has no credential-bearing fields"],
        typescript_references: &["src/lib/health/probes.ts"],
        generated_schema_gaps: &["not generated from TypeScript health probe types"],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.readiness",
        source_module: "crates/ordo-daemon/src/health.rs",
        fixture_names: &["DAEMON_READINESS_JSON_FIXTURE"],
        covered_status_values: &[
            "status:ok",
            "mode:pre_integration_runway",
            "subsystems.*.state:disabled",
        ],
        covered_classification_values: &[],
        redaction_coverage: &["same dormant public shape as health"],
        typescript_references: &["src/lib/health/probes.ts"],
        generated_schema_gaps: &["not generated from TypeScript readiness probe types"],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "node.job_event.fixture",
        source_module: "crates/ordo-daemon/src/runway_fixtures.rs",
        fixture_names: &["NODE_JOB_EVENT_JSON_FIXTURE"],
        covered_status_values: &["eventType:progress"],
        covered_classification_values: &[],
        redaction_coverage: &[
            "fixture contains only safe job identifiers and progress payload fields",
        ],
        typescript_references: &["src/core/entities/job.ts"],
        generated_schema_gaps: &["not generated from JobEvent TypeScript type"],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "node.job_progress_stream.fixture",
        source_module: "crates/ordo-daemon/src/runway_fixtures.rs",
        fixture_names: &["NODE_JOB_STREAM_EVENT_JSON_FIXTURE"],
        covered_status_values: &[
            "type:job_progress",
            "part.type:job_status",
            "part.status:running",
        ],
        covered_classification_values: &[],
        redaction_coverage: &["fixture contains only safe stream and job status fields"],
        typescript_references: &[
            "src/lib/jobs/job-publication.ts",
            "src/lib/jobs/job-status-snapshots.ts",
            "src/core/entities/message-parts.ts",
            "src/core/entities/chat-stream.ts",
        ],
        generated_schema_gaps: &[
            "not generated from StreamEvent or JobStatusMessagePart TypeScript types",
        ],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "runway.schema_snapshot_descriptors",
        source_module: "crates/ordo-daemon/src/runway_schema_snapshots.rs",
        fixture_names: &[
            "health_snapshot_descriptor",
            "readiness_snapshot_descriptor",
            "job_event_snapshot_descriptor",
            "job_progress_stream_snapshot_descriptor",
        ],
        covered_status_values: &["status:ok", "eventType:progress", "part.status:running"],
        covered_classification_values: &[],
        redaction_coverage: &["descriptor JSON excludes raw sensitive values"],
        typescript_references: &[
            "src/lib/health/probes.ts",
            "src/core/entities/job.ts",
            "src/lib/jobs/job-publication.ts",
            "src/lib/jobs/job-status-snapshots.ts",
        ],
        generated_schema_gaps: &["hand-authored descriptors are not JSON Schema exports"],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "runway.redaction.helper",
        source_module: "crates/ordo-daemon/src/redaction.rs",
        fixture_names: &["redact_sensitive_values"],
        covered_status_values: &[],
        covered_classification_values: &[],
        redaction_coverage: &[
            "credential key families",
            "authorization and cookie fields",
            "private key fields",
            "bearer string cleanup",
            "local user path strings",
        ],
        typescript_references: &[
            "src/lib/diagnostics/redaction.ts",
            "src/lib/observability/secret-redaction.ts",
        ],
        generated_schema_gaps: &[
            "helper behavior is not generated from TypeScript redaction utilities",
        ],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.crash_report.classifier",
        source_module: "crates/ordo-daemon/src/crash_report.rs",
        fixture_names: &[
            "TRANSIENT_CRASH_REPORT_JSON_FIXTURE",
            "POLICY_CRASH_REPORT_JSON_FIXTURE",
            "TERMINAL_CRASH_REPORT_JSON_FIXTURE",
            "CONFIG_CRASH_REPORT_JSON_FIXTURE",
        ],
        covered_status_values: &[
            "eventType:failed",
            "failureClass:transient",
            "failureClass:policy",
            "failureClass:terminal",
            "failureClass:unknown",
        ],
        covered_classification_values: &["config", "policy", "transient", "terminal", "unknown"],
        redaction_coverage: &["report context and error path are redacted before exposure"],
        typescript_references: &[
            "src/core/entities/job.ts",
            "src/lib/observability/runtime-audit-log.ts",
        ],
        generated_schema_gaps: &["not generated from a TypeScript crash report contract"],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.executor.request",
        source_module: "crates/ordo-daemon/src/executor_harness.rs",
        fixture_names: &[
            "EXECUTOR_REQUEST_JSON_FIXTURE",
            "request_from_job_event_fixture",
        ],
        covered_status_values: &["eventType:progress", "context.mode:pre_integration_runway"],
        covered_classification_values: &[],
        redaction_coverage: &["request context is redacted before exposure"],
        typescript_references: &["src/core/entities/job.ts"],
        generated_schema_gaps: &[
            "not generated from JobEvent or executor adapter TypeScript contracts",
        ],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.executor.response_outcomes",
        source_module: "crates/ordo-daemon/src/executor_harness.rs",
        fixture_names: &[
            "ExecutorHarnessResponse::progress",
            "ExecutorHarnessResponse::succeeded",
            "ExecutorHarnessResponse::failed",
            "ExecutorHarnessResponse::canceled",
            "ExecutorHarnessResponse::timed_out",
            "EXECUTOR_CANCELED_RESPONSE_JSON_FIXTURE",
            "EXECUTOR_TIMEOUT_RESPONSE_JSON_FIXTURE",
        ],
        covered_status_values: &[
            "status:running",
            "status:succeeded",
            "status:failed",
            "status:canceled",
            "eventType:progress",
            "eventType:result",
            "eventType:failed",
            "eventType:canceled",
        ],
        covered_classification_values: &[
            "progress",
            "succeeded",
            "failed",
            "canceled",
            "timeout",
            "unknown",
        ],
        redaction_coverage: &["response output context is redacted before exposure"],
        typescript_references: &[
            "src/core/entities/job.ts",
            "src/lib/jobs/job-publication.ts",
            "src/lib/jobs/job-status-snapshots.ts",
        ],
        generated_schema_gaps: &[
            "not generated from JobStatus, JobFailureClass, or JobEventType TypeScript unions",
        ],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.executor.invalid_output_validation",
        source_module: "crates/ordo-daemon/src/executor_harness.rs",
        fixture_names: &[
            "EXECUTOR_MALFORMED_RESPONSE_JSON_FIXTURE",
            "EXECUTOR_UNSUPPORTED_SCHEMA_RESPONSE_JSON_FIXTURE",
            "EXECUTOR_MISSING_FIELD_RESPONSE_JSON_FIXTURE",
            "EXECUTOR_UNKNOWN_STATUS_RESPONSE_JSON_FIXTURE",
            "EXECUTOR_UNKNOWN_EVENT_TYPE_RESPONSE_JSON_FIXTURE",
        ],
        covered_status_values: &["schemaVersion:2", "status:paused", "eventType:worker_lost"],
        covered_classification_values: &[
            "valid",
            "malformed_json",
            "unsupported_schema_version",
            "missing_required_field",
            "unknown_status",
            "unknown_event_type",
        ],
        redaction_coverage: &["parsed invalid-output value is redacted before exposure"],
        typescript_references: &[
            "src/core/entities/job.ts",
            "src/lib/jobs/job-publication.ts",
            "src/lib/jobs/job-status-snapshots.ts",
        ],
        generated_schema_gaps: &["not generated from executor stdout/stderr adapter schemas"],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.executor.contract_descriptors",
        source_module: "crates/ordo-daemon/src/executor_contract_descriptors.rs",
        fixture_names: &[
            "executor_request_descriptor",
            "executor_progress_response_descriptor",
            "executor_success_response_descriptor",
            "executor_failed_response_descriptor",
            "executor_canceled_response_descriptor",
            "executor_timeout_response_descriptor",
        ],
        covered_status_values: &[
            "status:running",
            "status:succeeded",
            "status:failed",
            "status:canceled",
            "failureClass:transient",
            "failureClass:canceled",
        ],
        covered_classification_values: &[],
        redaction_coverage: &["descriptor JSON excludes raw sensitive values"],
        typescript_references: &[
            "src/core/entities/job.ts",
            "src/lib/jobs/job-publication.ts",
            "src/lib/jobs/job-status-snapshots.ts",
        ],
        generated_schema_gaps: &["hand-authored descriptors are not generated JSON Schema"],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
    FixtureParityInventoryEntry {
        surface: "ordo-daemon.supervisor.dummy_child",
        source_module: "crates/ordo-daemon/src/supervisor_dummy_child.rs",
        fixture_names: &[
            "SUPERVISOR_DUMMY_CHILD_SUCCESS_JSON_FIXTURE",
            "SUPERVISOR_DUMMY_CHILD_NON_ZERO_EXIT_JSON_FIXTURE",
            "SUPERVISOR_DUMMY_CHILD_TIMEOUT_JSON_FIXTURE",
            "SUPERVISOR_DUMMY_CHILD_CANCELED_JSON_FIXTURE",
        ],
        covered_status_values: &[
            "status:exited",
            "status:timed_out",
            "status:canceled",
            "exitCode:0",
            "exitCode:non_zero",
            "signal:SIGTERM",
        ],
        covered_classification_values: &[
            "succeeded",
            "non_zero_exit",
            "timed_out",
            "canceled",
            "unknown",
        ],
        redaction_coverage: &["dummy-child context is redacted before exposure"],
        typescript_references: &[],
        generated_schema_gaps: &[
            "not generated from a TypeScript supervisor or process lifecycle contract",
        ],
        production_wiring: FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
    },
];

pub fn all_fixture_parity_inventory_entries() -> &'static [FixtureParityInventoryEntry] {
    FIXTURE_PARITY_INVENTORY
}

pub fn fixture_parity_inventory_json() -> serde_json::Result<Value> {
    Ok(json!({
        "schemaVersion": FIXTURE_PARITY_INVENTORY_SCHEMA_VERSION,
        "runtimeMode": FIXTURE_PARITY_INVENTORY_RUNTIME_MODE,
        "generatedSchemaStatus": FIXTURE_PARITY_INVENTORY_GENERATED_SCHEMA_STATUS,
        "productionWiring": FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING,
        "entries": serde_json::to_value(all_fixture_parity_inventory_entries())?
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crash_report::CRASH_REPORT_SCHEMA_VERSION;
    use crate::executor_contract_descriptors::all_executor_contract_descriptors;
    use crate::executor_harness::{
        classify_executor_response_contract, ExecutorContractValidationClassification,
        EXECUTOR_HARNESS_SCHEMA_VERSION, EXECUTOR_MALFORMED_RESPONSE_JSON_FIXTURE,
    };
    use crate::health::DAEMON_HEALTH_SCHEMA_VERSION;
    use crate::runway_fixtures::{DAEMON_HEALTH_JSON_FIXTURE, NODE_JOB_EVENT_JSON_FIXTURE};
    use crate::runway_schema_snapshots::all_snapshot_descriptors;
    use crate::supervisor_dummy_child::SUPERVISOR_DUMMY_CHILD_SCHEMA_VERSION;
    use std::collections::BTreeSet;

    fn entry_surfaces() -> BTreeSet<&'static str> {
        all_fixture_parity_inventory_entries()
            .iter()
            .map(|entry| entry.surface)
            .collect()
    }

    fn entry_for_surface(surface: &str) -> &'static FixtureParityInventoryEntry {
        all_fixture_parity_inventory_entries()
            .iter()
            .find(|entry| entry.surface == surface)
            .unwrap_or_else(|| panic!("missing fixture parity inventory surface: {surface}"))
    }

    #[test]
    fn fixture_parity_inventory_is_deterministic_json() {
        let first =
            serde_json::to_string_pretty(&fixture_parity_inventory_json().unwrap()).unwrap();
        let second =
            serde_json::to_string_pretty(&fixture_parity_inventory_json().unwrap()).unwrap();

        assert_eq!(first, second);
        assert!(first.contains("ordo-daemon.executor.response_outcomes"));
        assert!(first.contains("ordo-daemon.supervisor.dummy_child"));
        assert!(first.contains("generatedSchemaStatus"));
    }

    #[test]
    fn inventory_covers_current_dormant_runway_surfaces() {
        let surfaces = entry_surfaces();
        let expected_surfaces = [
            "ordo-daemon.health",
            "ordo-daemon.readiness",
            "node.job_event.fixture",
            "node.job_progress_stream.fixture",
            "runway.schema_snapshot_descriptors",
            "runway.redaction.helper",
            "ordo-daemon.crash_report.classifier",
            "ordo-daemon.executor.request",
            "ordo-daemon.executor.response_outcomes",
            "ordo-daemon.executor.invalid_output_validation",
            "ordo-daemon.executor.contract_descriptors",
            "ordo-daemon.supervisor.dummy_child",
        ];

        assert_eq!(surfaces.len(), expected_surfaces.len());
        for surface in expected_surfaces {
            assert!(
                surfaces.contains(surface),
                "inventory missing surface: {surface}"
            );
        }
    }

    #[test]
    fn inventory_entries_name_sources_redaction_and_schema_gaps() {
        for entry in all_fixture_parity_inventory_entries() {
            assert!(
                !entry.source_module.is_empty(),
                "missing source module for {}",
                entry.surface
            );
            assert!(
                !entry.fixture_names.is_empty(),
                "missing fixture names for {}",
                entry.surface
            );
            assert!(
                !entry.redaction_coverage.is_empty(),
                "missing redaction coverage for {}",
                entry.surface
            );
            assert!(
                !entry.generated_schema_gaps.is_empty(),
                "missing generated-schema gap for {}",
                entry.surface
            );
            assert_eq!(
                entry.production_wiring,
                FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING
            );
        }
    }

    #[test]
    fn inventory_status_and_classification_values_cover_existing_proofs() {
        let executor_outcomes = entry_for_surface("ordo-daemon.executor.response_outcomes");
        assert!(executor_outcomes
            .covered_status_values
            .contains(&"status:running"));
        assert!(executor_outcomes
            .covered_status_values
            .contains(&"status:succeeded"));
        assert!(executor_outcomes
            .covered_status_values
            .contains(&"status:failed"));
        assert!(executor_outcomes
            .covered_status_values
            .contains(&"status:canceled"));
        assert!(executor_outcomes
            .covered_classification_values
            .contains(&"timeout"));

        let invalid_output = entry_for_surface("ordo-daemon.executor.invalid_output_validation");
        assert!(invalid_output
            .covered_classification_values
            .contains(&"malformed_json"));
        assert!(invalid_output
            .covered_classification_values
            .contains(&"unsupported_schema_version"));
        assert!(invalid_output
            .covered_classification_values
            .contains(&"missing_required_field"));
        assert!(invalid_output
            .covered_classification_values
            .contains(&"unknown_status"));
        assert!(invalid_output
            .covered_classification_values
            .contains(&"unknown_event_type"));

        let supervisor = entry_for_surface("ordo-daemon.supervisor.dummy_child");
        assert!(supervisor
            .covered_classification_values
            .contains(&"succeeded"));
        assert!(supervisor
            .covered_classification_values
            .contains(&"non_zero_exit"));
        assert!(supervisor
            .covered_classification_values
            .contains(&"timed_out"));
        assert!(supervisor
            .covered_classification_values
            .contains(&"canceled"));
    }

    #[test]
    fn inventory_references_current_rust_and_typescript_contract_surfaces() {
        assert_eq!(
            DAEMON_HEALTH_SCHEMA_VERSION,
            FIXTURE_PARITY_INVENTORY_SCHEMA_VERSION
        );
        assert_eq!(
            EXECUTOR_HARNESS_SCHEMA_VERSION,
            FIXTURE_PARITY_INVENTORY_SCHEMA_VERSION
        );
        assert_eq!(
            CRASH_REPORT_SCHEMA_VERSION,
            FIXTURE_PARITY_INVENTORY_SCHEMA_VERSION
        );
        assert_eq!(
            SUPERVISOR_DUMMY_CHILD_SCHEMA_VERSION,
            FIXTURE_PARITY_INVENTORY_SCHEMA_VERSION
        );
        assert!(serde_json::from_str::<Value>(DAEMON_HEALTH_JSON_FIXTURE)
            .unwrap()
            .is_object());
        assert!(serde_json::from_str::<Value>(NODE_JOB_EVENT_JSON_FIXTURE)
            .unwrap()
            .is_object());
        assert!(!all_snapshot_descriptors().is_empty());
        assert!(!all_executor_contract_descriptors().is_empty());
        assert_eq!(
            classify_executor_response_contract(EXECUTOR_MALFORMED_RESPONSE_JSON_FIXTURE),
            ExecutorContractValidationClassification::MalformedJson
        );

        let job_event = entry_for_surface("node.job_event.fixture");
        assert!(job_event
            .typescript_references
            .contains(&"src/core/entities/job.ts"));
        let supervisor = entry_for_surface("ordo-daemon.supervisor.dummy_child");
        assert!(supervisor.typescript_references.is_empty());
    }

    #[test]
    fn inventory_is_static_and_disconnected_from_production_wiring() {
        let inventory = fixture_parity_inventory_json().unwrap();
        assert_eq!(
            inventory["runtimeMode"],
            FIXTURE_PARITY_INVENTORY_RUNTIME_MODE
        );
        assert_eq!(
            inventory["generatedSchemaStatus"],
            FIXTURE_PARITY_INVENTORY_GENERATED_SCHEMA_STATUS
        );
        assert_eq!(
            inventory["productionWiring"],
            FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING
        );

        for entry in inventory["entries"].as_array().unwrap() {
            assert_eq!(
                entry["productionWiring"],
                FIXTURE_PARITY_INVENTORY_PRODUCTION_WIRING
            );
            let joined_gaps = entry["generatedSchemaGaps"].to_string();
            assert!(
                joined_gaps.contains("not generated") || joined_gaps.contains("hand-authored"),
                "inventory entry should state generated-schema gap: {joined_gaps}"
            );
        }
    }
}
