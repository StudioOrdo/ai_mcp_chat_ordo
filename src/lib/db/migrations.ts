import type Database from "better-sqlite3";

function assertSafeIdentifier(value: string, kind: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe ${kind} identifier: ${value}`);
  }

  return value;
}

export function addColumnIfNotExists(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const safeTable = assertSafeIdentifier(table, "table");
  const safeColumn = assertSafeIdentifier(column, "column");
  const columns = db.pragma(`table_info(${safeTable})`) as Array<{ name: string }>;

  if (!columns.some((current) => current.name === safeColumn)) {
    try {
      db.exec(`ALTER TABLE ${safeTable} ADD COLUMN ${safeColumn} ${definition}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes(`duplicate column name: ${safeColumn}`)) {
        return;
      }

      throw error;
    }
  }
}

export function runMigrations(db: Database.Database): void {
  addColumnIfNotExists(db, "users", "password_hash", "TEXT");
  addColumnIfNotExists(db, "users", "created_at", "TEXT");
  db.exec("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL");

  addColumnIfNotExists(
    db,
    "conversations",
    "status",
    "TEXT NOT NULL DEFAULT 'active'",
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_user_status ON conversations(user_id, status)`);

  addColumnIfNotExists(db, "conversations", "converted_from", "TEXT DEFAULT NULL");
  addColumnIfNotExists(
    db,
    "conversations",
    "message_count",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfNotExists(db, "conversations", "first_message_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "last_tool_used", "TEXT DEFAULT NULL");
  addColumnIfNotExists(
    db,
    "conversations",
    "session_source",
    "TEXT NOT NULL DEFAULT 'unknown'",
  );
  addColumnIfNotExists(db, "conversations", "prompt_version", "INTEGER DEFAULT NULL");
  addColumnIfNotExists(
    db,
    "conversations",
    "lane",
    "TEXT NOT NULL DEFAULT 'uncertain'",
  );
  addColumnIfNotExists(db, "conversations", "lane_confidence", "REAL DEFAULT NULL");
  addColumnIfNotExists(
    db,
    "conversations",
    "recommended_next_step",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(
    db,
    "conversations",
    "detected_need_summary",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(
    db,
    "conversations",
    "lane_last_analyzed_at",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(db, "conversations", "referral_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "referral_source", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "deleted_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "deleted_by_user_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "delete_reason", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "purge_after", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "restored_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "imported_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "import_source_conversation_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "conversations", "imported_from_exported_at", "TEXT DEFAULT NULL");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_referral_id ON conversations(referral_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_user_status_deleted ON conversations(user_id, status, deleted_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_deleted_at ON conversations(deleted_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_purge_after ON conversations(purge_after)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_imported_at ON conversations(imported_at)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_purge_audits (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      purge_reason TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      purged_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_purge_audits_purged_at ON conversation_purge_audits(purged_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_purge_audits_reason ON conversation_purge_audits(purge_reason)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS identity_migration_events (
      id TEXT PRIMARY KEY,
      source_user_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      migrated_conversation_ids_json TEXT NOT NULL DEFAULT '[]',
      migrated_job_ids_json TEXT NOT NULL DEFAULT '[]',
      migrated_asset_ids_json TEXT NOT NULL DEFAULT '[]',
      repaired_memory_refs_json TEXT NOT NULL DEFAULT '[]',
      repaired_search_source_ids_json TEXT NOT NULL DEFAULT '[]',
      object_counts_json TEXT NOT NULL DEFAULT '[]',
      repair_refs_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      current_stage TEXT DEFAULT NULL,
      failure_message TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT NULL,
      FOREIGN KEY (source_user_id) REFERENCES users(id),
      FOREIGN KEY (target_user_id) REFERENCES users(id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_identity_migration_source_created ON identity_migration_events(source_user_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_identity_migration_target_created ON identity_migration_events(target_user_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_identity_migration_status_stage ON identity_migration_events(status, current_stage, created_at DESC)`);

  addColumnIfNotExists(
    db,
    "messages",
    "token_estimate",
    "INTEGER NOT NULL DEFAULT 0",
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_provenance_records (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_message_id TEXT NOT NULL,
      assistant_message_id TEXT DEFAULT NULL,
      surface TEXT NOT NULL,
      effective_hash TEXT NOT NULL,
      slot_refs_json TEXT NOT NULL DEFAULT '[]',
      sections_json TEXT NOT NULL DEFAULT '[]',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      replay_context_json TEXT NOT NULL DEFAULT '{}',
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prompt_provenance_conversation_recorded ON prompt_provenance_records(conversation_id, recorded_at)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_provenance_user_message ON prompt_provenance_records(user_message_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prompt_provenance_assistant_message ON prompt_provenance_records(assistant_message_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_bindings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT DEFAULT NULL,
      surface TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      source_prompt_binding_id TEXT DEFAULT NULL,
      effective_hash TEXT NOT NULL,
      slot_refs_json TEXT NOT NULL DEFAULT '[]',
      overlay_refs_json TEXT NOT NULL DEFAULT '[]',
      request_refs_json TEXT NOT NULL DEFAULT '[]',
      decision_source_refs_json TEXT NOT NULL DEFAULT '[]',
      evidence_refs_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (source_prompt_binding_id) REFERENCES prompt_bindings(id) ON DELETE SET NULL
    )
  `);
  addColumnIfNotExists(db, "prompt_bindings", "target_kind", "TEXT NOT NULL DEFAULT 'conversation'");
  addColumnIfNotExists(db, "prompt_bindings", "target_id", "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists(db, "prompt_bindings", "source_prompt_binding_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "prompt_bindings", "request_refs_json", "TEXT NOT NULL DEFAULT '[]'");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prompt_bindings_conversation_created ON prompt_bindings(conversation_id, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prompt_bindings_user_created ON prompt_bindings(user_id, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prompt_bindings_target ON prompt_bindings(target_kind, target_id, created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_prompt_bindings_source_binding ON prompt_bindings(source_prompt_binding_id, created_at)`);

  addColumnIfNotExists(db, "job_requests", "failure_class", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "next_retry_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "recovery_mode", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "last_checkpoint_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "replayed_from_job_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "superseded_by_job_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "origin_message_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "origin_turn_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "job_requests", "tool_invocation_id", "TEXT DEFAULT NULL");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_job_requests_replayed_from ON job_requests(replayed_from_job_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_job_requests_superseded_by ON job_requests(superseded_by_job_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_job_requests_origin_turn ON job_requests(origin_turn_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_job_requests_tool_invocation ON job_requests(tool_invocation_id)`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS materialization_records (
      id TEXT PRIMARY KEY,
      user_id TEXT DEFAULT NULL,
      conversation_id TEXT DEFAULT NULL,
      materialization_key TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      pipeline_version TEXT DEFAULT NULL,
      status TEXT NOT NULL,
      reuse_policy TEXT NOT NULL,
      input_source_refs_json TEXT NOT NULL DEFAULT '[]',
      output_refs_json TEXT NOT NULL DEFAULT '[]',
      evidence_refs_json TEXT NOT NULL DEFAULT '[]',
      produced_by_job_id TEXT DEFAULT NULL,
      superseded_by_record_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (produced_by_job_id) REFERENCES job_requests(id) ON DELETE SET NULL,
      FOREIGN KEY (superseded_by_record_id) REFERENCES materialization_records(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_materialization_key ON materialization_records(materialization_key)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_materialization_tool_status ON materialization_records(tool_name, status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_materialization_job ON materialization_records(produced_by_job_id)`);
  addColumnIfNotExists(db, "user_files", "metadata_json", "TEXT NOT NULL DEFAULT '{}'" );
  addColumnIfNotExists(db, "user_files", "status", "TEXT NOT NULL DEFAULT 'ready'" );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_uf_user_created_id ON user_files(user_id, created_at DESC, id DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_uf_created_id ON user_files(created_at DESC, id DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS media_workflows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      origin_message_id TEXT DEFAULT NULL,
      origin_turn_id TEXT DEFAULT NULL,
      requested_deliverable TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      final_asset_id TEXT DEFAULT NULL,
      failure_code TEXT DEFAULT NULL,
      failure_message TEXT DEFAULT NULL,
      request_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_media_workflows_conversation_created
      ON media_workflows(conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_media_workflows_user_status
      ON media_workflows(user_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_media_workflows_origin_message
      ON media_workflows(origin_message_id);

    CREATE TABLE IF NOT EXISTS media_workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      depends_on_step_ids_json TEXT NOT NULL DEFAULT '[]',
      job_id TEXT DEFAULT NULL,
      asset_id TEXT DEFAULT NULL,
      input_json TEXT NOT NULL DEFAULT '{}',
      output_json TEXT NOT NULL DEFAULT '{}',
      failure_code TEXT DEFAULT NULL,
      failure_message TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workflow_id) REFERENCES media_workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_media_workflow_steps_sequence
      ON media_workflow_steps(workflow_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_media_workflow_steps_workflow_status
      ON media_workflow_steps(workflow_id, status, sequence);
    CREATE INDEX IF NOT EXISTS idx_media_workflow_steps_job
      ON media_workflow_steps(job_id);
    CREATE INDEX IF NOT EXISTS idx_media_workflow_steps_asset
      ON media_workflow_steps(asset_id);

    CREATE TABLE IF NOT EXISTS media_workflow_events (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      step_id TEXT DEFAULT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workflow_id) REFERENCES media_workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (step_id) REFERENCES media_workflow_steps(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_workflow_events_workflow_created
      ON media_workflow_events(workflow_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_media_workflow_events_step
      ON media_workflow_events(step_id, created_at);
  `);

  addColumnIfNotExists(
    db,
    "lead_records",
    "triage_state",
    "TEXT NOT NULL DEFAULT 'new'",
  );
  addColumnIfNotExists(db, "lead_records", "founder_note", "TEXT DEFAULT NULL");
  addColumnIfNotExists(
    db,
    "lead_records",
    "last_contacted_at",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(db, "lead_records", "triaged_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(
    db,
    "lead_records",
    "authority_level",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(db, "lead_records", "urgency", "TEXT DEFAULT NULL");
  addColumnIfNotExists(
    db,
    "lead_records",
    "budget_signal",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(
    db,
    "lead_records",
    "technical_environment",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(
    db,
    "lead_records",
    "training_fit",
    "TEXT DEFAULT NULL",
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_lead_records_triage_state ON lead_records(triage_state)`);

  addColumnIfNotExists(db, "lead_records", "follow_up_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "deal_records", "follow_up_at", "TEXT DEFAULT NULL");

  addColumnIfNotExists(
    db,
    "users",
    "affiliate_enabled",
    "INTEGER NOT NULL DEFAULT 0",
  );
  addColumnIfNotExists(db, "users", "referral_code", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "users", "credential", "TEXT DEFAULT NULL");
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code)`);

  addColumnIfNotExists(db, "referrals", "referred_user_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "referrals", "visit_id", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "referrals", "status", "TEXT NOT NULL DEFAULT 'visited'");
  addColumnIfNotExists(db, "referrals", "credit_status", "TEXT NOT NULL DEFAULT 'tracked'");
  addColumnIfNotExists(db, "referrals", "last_validated_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "referrals", "last_event_at", "TEXT DEFAULT NULL");
  addColumnIfNotExists(db, "referrals", "metadata_json", "TEXT NOT NULL DEFAULT '{}'"
  );
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_visit_id ON referrals(visit_id) WHERE visit_id IS NOT NULL`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_referrals_referred_user ON referrals(referred_user_id)`);
  db.exec(`
    UPDATE referrals
    SET last_validated_at = COALESCE(last_validated_at, scanned_at, converted_at, created_at)
    WHERE last_validated_at IS NULL
  `);
  db.exec(`
    UPDATE referrals
    SET last_event_at = COALESCE(last_event_at, converted_at, scanned_at, created_at)
    WHERE last_event_at IS NULL
  `);
  db.exec(`
    UPDATE conversations
    SET referral_id = (
      SELECT r.id
      FROM referrals r
      WHERE r.conversation_id = conversations.id
      ORDER BY r.created_at DESC
      LIMIT 1
    )
    WHERE referral_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM referrals r
        WHERE r.conversation_id = conversations.id
      )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS referral_events (
      id TEXT PRIMARY KEY,
      referral_id TEXT NOT NULL,
      conversation_id TEXT DEFAULT NULL,
      event_type TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_referral_events_referral ON referral_events(referral_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_referral_events_type ON referral_events(event_type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_referral_events_conversation ON referral_events(conversation_id)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_events_dedupe ON referral_events(referral_id, idempotency_key)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_assets (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      kind TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      alt_text TEXT NOT NULL DEFAULT '',
      source_prompt TEXT,
      provider TEXT,
      provider_model TEXT,
      visibility TEXT NOT NULL DEFAULT 'draft',
      selection_state TEXT NOT NULL DEFAULT 'candidate',
      variation_group_id TEXT DEFAULT NULL,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_blog_assets_post ON blog_assets(post_id);
    CREATE INDEX IF NOT EXISTS idx_blog_assets_visibility ON blog_assets(visibility);
    CREATE INDEX IF NOT EXISTS idx_blog_assets_created_by ON blog_assets(created_by_user_id);
  `);
  addColumnIfNotExists(
    db,
    "blog_assets",
    "selection_state",
    "TEXT NOT NULL DEFAULT 'candidate'",
  );
  addColumnIfNotExists(
    db,
    "blog_assets",
    "variation_group_id",
    "TEXT DEFAULT NULL",
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_blog_assets_selection_state ON blog_assets(selection_state)`);
  db.exec(`
    UPDATE blog_assets
    SET selection_state = 'selected'
    WHERE id IN (
      SELECT hero_image_asset_id
      FROM blog_posts
      WHERE hero_image_asset_id IS NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_post_artifacts (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_blog_post_artifacts_post ON blog_post_artifacts(post_id);
    CREATE INDEX IF NOT EXISTS idx_blog_post_artifacts_type ON blog_post_artifacts(artifact_type);
  `);

  addColumnIfNotExists(
    db,
    "blog_posts",
    "standfirst",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(
    db,
    "blog_posts",
    "section",
    "TEXT DEFAULT NULL",
  );
  addColumnIfNotExists(
    db,
    "blog_posts",
    "hero_image_asset_id",
    "TEXT DEFAULT NULL REFERENCES blog_assets(id)",
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_blog_posts_hero_image_asset ON blog_posts(hero_image_asset_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_blog_posts_section ON blog_posts(section)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_post_revisions (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      change_note TEXT DEFAULT NULL,
      created_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_blog_post_revisions_post ON blog_post_revisions(post_id);
    CREATE INDEX IF NOT EXISTS idx_blog_post_revisions_created_at ON blog_post_revisions(created_at);
  `);
}
