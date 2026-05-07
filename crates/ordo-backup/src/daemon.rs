use crate::backup_executor::execute_backup;
use crate::command::{parse_backup_payload, parse_restore_payload, CommandName};
use crate::command_store::CommandStore;
use crate::restore_executor::execute_restore;
use anyhow::Result;
use std::thread;
use std::time::Duration;

pub fn run_once(store: &mut CommandStore) -> Result<bool> {
    store.recover_expired_running()?;
    let Some(command) = store.claim_next()? else {
        return Ok(false);
    };
    match command.command {
        CommandName::BackupCreate => {
            let payload = parse_backup_payload(&command.payload_json)?;
            execute_backup(store, &command.id, &payload)?;
        }
        CommandName::RestoreRequest => {
            let payload = parse_restore_payload(&command.payload_json)?;
            execute_restore(store, &command.id, &payload)?;
        }
    }
    Ok(true)
}

pub fn run_forever(store: CommandStore, poll_interval_ms: u64) -> Result<()> {
    let mut store = store;
    loop {
        if !run_once(&mut store)? {
            thread::sleep(Duration::from_millis(poll_interval_ms));
        }
    }
}
