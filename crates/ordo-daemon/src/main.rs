#![deny(clippy::all)]

use anyhow::Result;
use clap::{Parser, Subcommand};
use ordo_daemon::health::{build_health_report, build_readiness_report};
use ordo_daemon::http::serve_once;

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Print the dormant daemon health contract as JSON.
    HealthJson,
    /// Print the dormant daemon readiness contract as JSON.
    ReadyJson,
    /// Serve exactly one local HTTP health request, then exit.
    ServeOnce {
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 17760)]
        port: u16,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::HealthJson => {
            println!("{}", serde_json::to_string_pretty(&build_health_report())?);
        }
        Commands::ReadyJson => {
            println!(
                "{}",
                serde_json::to_string_pretty(&build_readiness_report())?
            );
        }
        Commands::ServeOnce { host, port } => {
            serve_once(&host, port)?;
        }
    }
    Ok(())
}
