#![deny(clippy::all)]

use anyhow::Result;
use clap::{Parser, Subcommand};
use uuid::Uuid;

use ordo_backup::{command_store::CommandStore, daemon};

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run the governed background polling daemon.
    Daemon {
        #[arg(long)]
        db_path: String,
        #[arg(long, default_value_t = 2_000)]
        poll_interval_ms: u64,
        #[arg(long, default_value_t = 900)]
        lease_seconds: i64,
        #[arg(long)]
        lease_owner: Option<String>,
    },
    /// Process at most one pending command. Intended for tests and local diagnostics.
    RunOnce {
        #[arg(long)]
        db_path: String,
        #[arg(long, default_value_t = 900)]
        lease_seconds: i64,
        #[arg(long)]
        lease_owner: Option<String>,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Daemon {
            db_path,
            poll_interval_ms,
            lease_seconds,
            lease_owner,
        } => {
            let store = CommandStore::open(
                &db_path,
                lease_owner.unwrap_or_else(default_lease_owner),
                lease_seconds,
            )?;
            daemon::run_forever(store, poll_interval_ms)?;
        }
        Commands::RunOnce {
            db_path,
            lease_seconds,
            lease_owner,
        } => {
            let mut store = CommandStore::open(
                &db_path,
                lease_owner.unwrap_or_else(default_lease_owner),
                lease_seconds,
            )?;
            daemon::run_once(&mut store)?;
        }
    }
    Ok(())
}

fn default_lease_owner() -> String {
    format!("ordo-backup-{}", Uuid::new_v4())
}
