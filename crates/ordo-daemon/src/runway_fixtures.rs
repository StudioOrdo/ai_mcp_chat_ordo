use serde::Deserialize;
use serde_json::Value;

pub const DAEMON_HEALTH_JSON_FIXTURE: &str = r#"
{
  "schemaVersion": "1",
  "service": "ordo-daemon",
  "version": "0.1.0",
  "status": "ok",
  "mode": "pre_integration_runway",
  "subsystems": {
    "applianceNetworking": { "enabled": false, "state": "disabled" },
    "jobs": { "enabled": false, "state": "disabled" },
    "realtime": { "enabled": false, "state": "disabled" },
    "scheduler": { "enabled": false, "state": "disabled" },
    "search": { "enabled": false, "state": "disabled" }
  },
  "notes": [
    "Dormant health proof only; not wired into Node, Docker, compose, jobs, realtime, search, scheduler, or TLS."
  ]
}
"#;

pub const DAEMON_READINESS_JSON_FIXTURE: &str = DAEMON_HEALTH_JSON_FIXTURE;

pub const NODE_JOB_EVENT_JSON_FIXTURE: &str = r#"
{
  "id": "jobevt_fixture_001",
  "jobId": "job_fixture_001",
  "conversationId": "conv_fixture_001",
  "sequence": 12,
  "eventType": "progress",
  "payload": {
    "progressPercent": 42,
    "progressLabel": "Rendering preview",
    "summary": "Preview render in progress."
  },
  "createdAt": "2026-05-06T12:00:00.000Z"
}
"#;

pub const NODE_JOB_STREAM_EVENT_JSON_FIXTURE: &str = r#"
{
  "type": "job_progress",
  "messageId": "job-status-job_fixture_001",
  "jobId": "job_fixture_001",
  "conversationId": "conv_fixture_001",
  "sequence": 12,
  "toolName": "generate_chart",
  "label": "Generate Chart",
  "title": "Render campaign chart",
  "subtitle": "Generate a portable chart artifact.",
  "progressPercent": 42,
  "progressLabel": "Rendering preview",
  "updatedAt": "2026-05-06T12:00:00.000Z",
  "part": {
    "type": "job_status",
    "jobId": "job_fixture_001",
    "toolName": "generate_chart",
    "label": "Generate Chart",
    "title": "Render campaign chart",
    "subtitle": "Generate a portable chart artifact.",
    "status": "running",
    "sequence": 12,
    "progressPercent": 42,
    "progressLabel": "Rendering preview",
    "updatedAt": "2026-05-06T12:00:00.000Z"
  }
}
"#;

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FixtureJobEvent {
    pub id: String,
    pub job_id: String,
    pub conversation_id: String,
    pub sequence: u64,
    pub event_type: String,
    pub payload: Value,
    pub created_at: String,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FixtureJobStatusPart {
    pub r#type: String,
    pub job_id: String,
    pub tool_name: String,
    pub label: String,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub status: String,
    pub sequence: Option<u64>,
    pub progress_percent: Option<u8>,
    pub progress_label: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FixtureJobStreamEvent {
    pub r#type: String,
    pub message_id: Option<String>,
    pub job_id: String,
    pub conversation_id: String,
    pub sequence: u64,
    pub tool_name: String,
    pub label: String,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub progress_percent: Option<u8>,
    pub progress_label: Option<String>,
    pub updated_at: Option<String>,
    pub part: Option<FixtureJobStatusPart>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::health::{
        DaemonHealthReport, DAEMON_HEALTH_SCHEMA_VERSION, DAEMON_SERVICE_NAME,
        DISABLED_SUBSYSTEM_NAMES, PRE_INTEGRATION_MODE,
    };

    const SENSITIVE_FIXTURE_TERMS: [&str; 14] = [
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

    fn assert_fixture_is_safe(json: &str) {
        let normalized = json.to_ascii_lowercase();
        for term in SENSITIVE_FIXTURE_TERMS {
            assert!(
                !normalized.contains(term),
                "runway fixture should not include sensitive term: {term}"
            );
        }
    }

    fn assert_health_fixture_matches_dormant_contract(json: &str) {
        let report: DaemonHealthReport = serde_json::from_str(json).unwrap();
        assert_eq!(report.schema_version, DAEMON_HEALTH_SCHEMA_VERSION);
        assert_eq!(report.service, DAEMON_SERVICE_NAME);
        assert_eq!(report.status, "ok");
        assert_eq!(report.mode, PRE_INTEGRATION_MODE);
        assert_eq!(report.subsystems.len(), DISABLED_SUBSYSTEM_NAMES.len());

        for name in DISABLED_SUBSYSTEM_NAMES {
            let subsystem = report
                .subsystems
                .get(name)
                .unwrap_or_else(|| panic!("missing subsystem in fixture: {name}"));
            assert!(!subsystem.enabled);
            assert_eq!(subsystem.state, "disabled");
        }
    }

    #[test]
    fn health_and_readiness_fixtures_parse_as_dormant_contracts() {
        assert_health_fixture_matches_dormant_contract(DAEMON_HEALTH_JSON_FIXTURE);
        assert_health_fixture_matches_dormant_contract(DAEMON_READINESS_JSON_FIXTURE);
    }

    #[test]
    fn node_job_event_fixture_parses_without_runtime_ownership() {
        let event: FixtureJobEvent = serde_json::from_str(NODE_JOB_EVENT_JSON_FIXTURE).unwrap();
        assert_eq!(event.id, "jobevt_fixture_001");
        assert_eq!(event.job_id, "job_fixture_001");
        assert_eq!(event.conversation_id, "conv_fixture_001");
        assert_eq!(event.sequence, 12);
        assert_eq!(event.event_type, "progress");
        assert_eq!(event.payload["progressPercent"], 42);
        assert_eq!(event.payload["progressLabel"], "Rendering preview");
    }

    #[test]
    fn node_job_stream_event_fixture_parses_publication_shape() {
        let event: FixtureJobStreamEvent =
            serde_json::from_str(NODE_JOB_STREAM_EVENT_JSON_FIXTURE).unwrap();
        let part = event
            .part
            .as_ref()
            .expect("stream fixture should include part");

        assert_eq!(event.r#type, "job_progress");
        assert_eq!(
            event.message_id.as_deref(),
            Some("job-status-job_fixture_001")
        );
        assert_eq!(event.job_id, part.job_id);
        assert_eq!(event.sequence, part.sequence.unwrap());
        assert_eq!(event.tool_name, part.tool_name);
        assert_eq!(event.progress_percent, Some(42));
        assert_eq!(event.progress_label.as_deref(), Some("Rendering preview"));
        assert_eq!(part.r#type, "job_status");
        assert_eq!(part.status, "running");
    }

    #[test]
    fn runway_fixtures_do_not_include_sensitive_values() {
        for fixture in [
            DAEMON_HEALTH_JSON_FIXTURE,
            DAEMON_READINESS_JSON_FIXTURE,
            NODE_JOB_EVENT_JSON_FIXTURE,
            NODE_JOB_STREAM_EVENT_JSON_FIXTURE,
        ] {
            assert_fixture_is_safe(fixture);
        }
    }
}
