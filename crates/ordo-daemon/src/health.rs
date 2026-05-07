use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const DAEMON_HEALTH_SCHEMA_VERSION: &str = "1";
pub const DAEMON_SERVICE_NAME: &str = "ordo-daemon";
pub const PRE_INTEGRATION_MODE: &str = "pre_integration_runway";
pub const DISABLED_SUBSYSTEM_NAMES: [&str; 5] = [
    "jobs",
    "realtime",
    "search",
    "scheduler",
    "applianceNetworking",
];

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubsystemHealth {
    pub enabled: bool,
    pub state: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DaemonHealthReport {
    pub schema_version: String,
    pub service: String,
    pub version: String,
    pub status: String,
    pub mode: String,
    pub subsystems: BTreeMap<String, SubsystemHealth>,
    pub notes: Vec<String>,
}

pub fn build_health_report() -> DaemonHealthReport {
    DaemonHealthReport {
        schema_version: DAEMON_HEALTH_SCHEMA_VERSION.to_string(),
        service: DAEMON_SERVICE_NAME.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        status: "ok".to_string(),
        mode: PRE_INTEGRATION_MODE.to_string(),
        subsystems: disabled_subsystems(),
        notes: vec![
            "Dormant health proof only; not wired into Node, Docker, compose, jobs, realtime, search, scheduler, or TLS.".to_string(),
        ],
    }
}

pub fn build_readiness_report() -> DaemonHealthReport {
    build_health_report()
}

fn disabled_subsystems() -> BTreeMap<String, SubsystemHealth> {
    DISABLED_SUBSYSTEM_NAMES
        .into_iter()
        .map(|name| {
            (
                name.to_string(),
                SubsystemHealth {
                    enabled: false,
                    state: "disabled".to_string(),
                },
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SENSITIVE_OUTPUT_TERMS: [&str; 11] = [
        "apikey",
        "api_key",
        "credential",
        "database",
        "environment",
        "password",
        "secret",
        "sqlite",
        "token",
        "userhome",
        "user_home",
    ];

    fn assert_public_health_json_is_safe(json: &str) {
        let normalized = json.to_ascii_lowercase();
        for term in SENSITIVE_OUTPUT_TERMS {
            assert!(
                !normalized.contains(term),
                "health output should not contain sensitive term: {term}"
            );
        }
    }

    #[test]
    fn health_report_is_dormant_and_camel_case_serialized() {
        let report = build_health_report();
        assert_eq!(report.schema_version, DAEMON_HEALTH_SCHEMA_VERSION);
        assert_eq!(report.service, DAEMON_SERVICE_NAME);
        assert_eq!(report.status, "ok");
        assert_eq!(report.mode, PRE_INTEGRATION_MODE);

        let value = serde_json::to_value(report).unwrap();
        assert_eq!(value["schemaVersion"], DAEMON_HEALTH_SCHEMA_VERSION);
        assert_eq!(
            value["subsystems"]["applianceNetworking"]["state"],
            "disabled"
        );
    }

    #[test]
    fn all_runway_subsystems_are_disabled_by_default() {
        let report = build_health_report();
        assert_eq!(report.subsystems.len(), DISABLED_SUBSYSTEM_NAMES.len());

        for name in DISABLED_SUBSYSTEM_NAMES {
            let subsystem = report
                .subsystems
                .get(name)
                .unwrap_or_else(|| panic!("missing subsystem: {name}"));
            assert!(!subsystem.enabled, "subsystem should be disabled: {name}");
            assert_eq!(subsystem.state, "disabled");
        }
    }

    #[test]
    fn health_and_readiness_json_do_not_expose_sensitive_names() {
        let health_json = serde_json::to_string(&build_health_report()).unwrap();
        let readiness_json = serde_json::to_string(&build_readiness_report()).unwrap();

        assert_public_health_json_is_safe(&health_json);
        assert_public_health_json_is_safe(&readiness_json);
    }

    #[test]
    fn readiness_matches_health_while_inert() {
        assert_eq!(build_readiness_report(), build_health_report());
    }
}
