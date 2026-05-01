import type Database from "better-sqlite3";

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      referral_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      parts TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id);
  `);

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
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_provenance_conversation_recorded
      ON prompt_provenance_records(conversation_id, recorded_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_provenance_user_message
      ON prompt_provenance_records(user_message_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_provenance_assistant_message
      ON prompt_provenance_records(assistant_message_id);
  `);

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
      decision_source_refs_json TEXT NOT NULL DEFAULT '[]',
      evidence_refs_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (source_prompt_binding_id) REFERENCES prompt_bindings(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_bindings_conversation_created
      ON prompt_bindings(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_prompt_bindings_user_created
      ON prompt_bindings(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_prompt_bindings_target
      ON prompt_bindings(target_kind, target_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_prompt_bindings_source_binding
      ON prompt_bindings(source_prompt_binding_id, created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS relationship_memory_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      memory_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      evidence_refs_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      confidence REAL NOT NULL,
      superseded_by_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (superseded_by_id) REFERENCES relationship_memory_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_relationship_memory_conversation_status
      ON relationship_memory_records(conversation_id, status, updated_at DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_relationship_memory_user_status
      ON relationship_memory_records(user_id, status, updated_at DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_relationship_memory_type_status
      ON relationship_memory_records(memory_type, status, updated_at DESC, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_events (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_conv_events_conv ON conversation_events(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_conv_events_type ON conversation_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_conv_events_created ON conversation_events(created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_purge_audits (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      purge_reason TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      purged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_conv_purge_audits_purged_at ON conversation_purge_audits(purged_at);
    CREATE INDEX IF NOT EXISTS idx_conv_purge_audits_reason ON conversation_purge_audits(purge_reason);
  `);

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
    );
    CREATE INDEX IF NOT EXISTS idx_identity_migration_source_created
      ON identity_migration_events(source_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_identity_migration_target_created
      ON identity_migration_events(target_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_identity_migration_status_stage
      ON identity_migration_events(status, current_stage, created_at DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_records (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL UNIQUE,
      lane TEXT NOT NULL DEFAULT 'uncertain',
      name TEXT DEFAULT NULL,
      email TEXT DEFAULT NULL,
      organization TEXT DEFAULT NULL,
      role_or_title TEXT DEFAULT NULL,
      training_goal TEXT DEFAULT NULL,
      authority_level TEXT DEFAULT NULL,
      urgency TEXT DEFAULT NULL,
      budget_signal TEXT DEFAULT NULL,
      technical_environment TEXT DEFAULT NULL,
      training_fit TEXT DEFAULT NULL,
      problem_summary TEXT DEFAULT NULL,
      recommended_next_action TEXT DEFAULT NULL,
      capture_status TEXT NOT NULL DEFAULT 'not_started',
      triage_state TEXT NOT NULL DEFAULT 'new',
      founder_note TEXT DEFAULT NULL,
      last_contacted_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      submitted_at TEXT DEFAULT NULL,
      triaged_at TEXT DEFAULT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_lead_records_conversation ON lead_records(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_lead_records_status ON lead_records(capture_status);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS consultation_requests (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      lane TEXT NOT NULL DEFAULT 'uncertain',
      request_summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      founder_note TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_cr_conversation ON consultation_requests(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_cr_user ON consultation_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_cr_status ON consultation_requests(status);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS deal_records (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      consultation_request_id TEXT DEFAULT NULL UNIQUE,
      lead_record_id TEXT DEFAULT NULL UNIQUE,
      user_id TEXT NOT NULL,
      lane TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      organization_name TEXT DEFAULT NULL,
      problem_summary TEXT NOT NULL DEFAULT '',
      proposed_scope TEXT NOT NULL DEFAULT '',
      recommended_service_type TEXT NOT NULL DEFAULT '',
      estimated_hours REAL DEFAULT NULL,
      estimated_training_days REAL DEFAULT NULL,
      estimated_price INTEGER DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      next_action TEXT DEFAULT NULL,
      assumptions TEXT DEFAULT NULL,
      open_questions TEXT DEFAULT NULL,
      founder_note TEXT DEFAULT NULL,
      customer_response_note TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (consultation_request_id) REFERENCES consultation_requests(id) ON DELETE SET NULL,
      FOREIGN KEY (lead_record_id) REFERENCES lead_records(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      CHECK (consultation_request_id IS NOT NULL OR lead_record_id IS NOT NULL)
    );
    CREATE INDEX IF NOT EXISTS idx_deal_records_user ON deal_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_deal_records_status ON deal_records(status);
    CREATE INDEX IF NOT EXISTS idx_deal_records_lane ON deal_records(lane);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS training_path_records (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      lead_record_id TEXT DEFAULT NULL UNIQUE,
      consultation_request_id TEXT DEFAULT NULL UNIQUE,
      user_id TEXT NOT NULL,
      lane TEXT NOT NULL,
      current_role_or_background TEXT DEFAULT NULL,
      technical_depth TEXT DEFAULT NULL,
      primary_goal TEXT DEFAULT NULL,
      preferred_format TEXT DEFAULT NULL,
      apprenticeship_interest TEXT DEFAULT NULL,
      recommended_path TEXT NOT NULL DEFAULT 'continue_conversation',
      fit_rationale TEXT DEFAULT NULL,
      customer_summary TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      next_action TEXT DEFAULT NULL,
      founder_note TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_record_id) REFERENCES lead_records(id) ON DELETE SET NULL,
      FOREIGN KEY (consultation_request_id) REFERENCES consultation_requests(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      CHECK (lane = 'individual'),
      CHECK (lead_record_id IS NOT NULL OR consultation_request_id IS NOT NULL)
    );
    CREATE INDEX IF NOT EXISTS idx_training_path_records_user ON training_path_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_training_path_records_status ON training_path_records(status);
    CREATE INDEX IF NOT EXISTS idx_training_path_records_recommended_path ON training_path_records(recommended_path);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_level TEXT NOT NULL,
      heading TEXT,
      content TEXT NOT NULL,
      embedding_input TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      model_version TEXT NOT NULL,
      embedding BLOB NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_emb_source_type ON embeddings(source_type);
    CREATE INDEX IF NOT EXISTS idx_emb_source_id ON embeddings(source_id);
    CREATE INDEX IF NOT EXISTS idx_emb_level ON embeddings(chunk_level);
    CREATE INDEX IF NOT EXISTS idx_emb_hash ON embeddings(source_id, content_hash);
    CREATE INDEX IF NOT EXISTS idx_emb_model ON embeddings(model_version);

    CREATE TABLE IF NOT EXISTS bm25_stats (
      source_type TEXT PRIMARY KEY,
      stats_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS embedding_fts USING fts5(
      id UNINDEXED,
      source_type UNINDEXED,
      source_id UNINDEXED,
      chunk_level UNINDEXED,
      content,
      heading,
      metadata_text
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT,
      content_hash TEXT NOT NULL,
      file_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_uf_user ON user_files(user_id);
    CREATE INDEX IF NOT EXISTS idx_uf_hash ON user_files(user_id, content_hash, file_type);
    CREATE INDEX IF NOT EXISTS idx_uf_conv ON user_files(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_uf_user_created_id ON user_files(user_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_uf_created_id ON user_files(created_at DESC, id DESC);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_user_id TEXT NOT NULL,
      referred_user_id TEXT DEFAULT NULL,
      conversation_id TEXT,
      referral_code TEXT NOT NULL,
      visit_id TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'visited',
      credit_status TEXT NOT NULL DEFAULT 'tracked',
      scanned_at TEXT,
      converted_at TEXT,
      last_validated_at TEXT DEFAULT NULL,
      last_event_at TEXT DEFAULT NULL,
      outcome TEXT DEFAULT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (referrer_user_id) REFERENCES users(id),
      FOREIGN KEY (referred_user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_conversation ON referrals(conversation_id);
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
    );
    CREATE INDEX IF NOT EXISTS idx_referral_events_referral ON referral_events(referral_id);
    CREATE INDEX IF NOT EXISTS idx_referral_events_type ON referral_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_referral_events_conversation ON referral_events(conversation_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_events_dedupe ON referral_events(referral_id, idempotency_key);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pref_key
      ON user_preferences(user_id, key);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_prompts (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      prompt_type TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT DEFAULT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_active
      ON system_prompts(role, prompt_type) WHERE is_active = 1;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      standfirst TEXT DEFAULT NULL,
      section TEXT DEFAULT NULL,
      hero_image_asset_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by_user_id TEXT NOT NULL,
      published_by_user_id TEXT,
      FOREIGN KEY (hero_image_asset_id) REFERENCES blog_assets(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id),
      FOREIGN KEY (published_by_user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
  `);

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS job_requests (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT DEFAULT NULL,
      tool_name TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 100,
      dedupe_key TEXT DEFAULT NULL,
      initiator_type TEXT NOT NULL DEFAULT 'user',
      request_payload_json TEXT NOT NULL,
      result_payload_json TEXT DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      progress_percent REAL DEFAULT NULL,
      progress_label TEXT DEFAULT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      lease_expires_at TEXT DEFAULT NULL,
      claimed_by TEXT DEFAULT NULL,
      failure_class TEXT DEFAULT NULL,
      next_retry_at TEXT DEFAULT NULL,
      recovery_mode TEXT DEFAULT NULL,
      last_checkpoint_id TEXT DEFAULT NULL,
      replayed_from_job_id TEXT DEFAULT NULL,
      superseded_by_job_id TEXT DEFAULT NULL,
      origin_message_id TEXT DEFAULT NULL,
      origin_turn_id TEXT DEFAULT NULL,
      tool_invocation_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (replayed_from_job_id) REFERENCES job_requests(id) ON DELETE SET NULL,
      FOREIGN KEY (superseded_by_job_id) REFERENCES job_requests(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_job_requests_conversation ON job_requests(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_job_requests_user_status ON job_requests(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_job_requests_status_priority_created ON job_requests(status, priority, created_at);
    CREATE INDEX IF NOT EXISTS idx_job_requests_dedupe_conversation ON job_requests(conversation_id, dedupe_key);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS job_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_job_events_conversation_sequence_unique ON job_events(conversation_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_job_events_job_created ON job_events(job_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_job_events_job_sequence ON job_events(job_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_job_events_conversation_sequence ON job_events(conversation_id, sequence);
  `);

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
    );

    CREATE INDEX IF NOT EXISTS idx_materialization_key ON materialization_records(materialization_key);
    CREATE INDEX IF NOT EXISTS idx_materialization_tool_status ON materialization_records(tool_name, status);
    CREATE INDEX IF NOT EXISTS idx_materialization_job ON materialization_records(produced_by_job_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS factory_work_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_id TEXT DEFAULT NULL,
      status TEXT NOT NULL,
      current_dag_id TEXT DEFAULT NULL,
      current_stage_key TEXT DEFAULT NULL,
      active_checkpoint_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      paused_at TEXT DEFAULT NULL,
      snapshot_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_factory_work_orders_user_status
      ON factory_work_orders(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_factory_work_orders_conversation_created
      ON factory_work_orders(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_factory_work_orders_status_created
      ON factory_work_orders(status, created_at);

    CREATE TABLE IF NOT EXISTS factory_work_order_parents (
      work_order_id TEXT NOT NULL,
      parent_work_order_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      relationship_kind TEXT NOT NULL DEFAULT 'revision_parent',
      PRIMARY KEY (work_order_id, parent_work_order_id),
      FOREIGN KEY (work_order_id) REFERENCES factory_work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_work_order_id) REFERENCES factory_work_orders(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_work_order_parents_ordinal
      ON factory_work_order_parents(work_order_id, ordinal);
    CREATE INDEX IF NOT EXISTS idx_factory_work_order_parents_parent
      ON factory_work_order_parents(parent_work_order_id);

    CREATE TABLE IF NOT EXISTS factory_production_dags (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      dag_version INTEGER NOT NULL,
      generated_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      FOREIGN KEY (work_order_id) REFERENCES factory_work_orders(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_production_dags_work_order_version
      ON factory_production_dags(work_order_id, dag_version);
    CREATE INDEX IF NOT EXISTS idx_factory_production_dags_work_order_generated
      ON factory_production_dags(work_order_id, generated_at DESC);

    CREATE TABLE IF NOT EXISTS factory_stage_runs (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      stage_key TEXT NOT NULL,
      stage_kind TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL,
      result_entity_kind TEXT DEFAULT NULL,
      result_entity_id TEXT DEFAULT NULL,
      error_json TEXT DEFAULT NULL,
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      snapshot_json TEXT NOT NULL,
      FOREIGN KEY (work_order_id) REFERENCES factory_work_orders(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_stage_runs_work_order_stage
      ON factory_stage_runs(work_order_id, stage_key);
    CREATE INDEX IF NOT EXISTS idx_factory_stage_runs_work_order_status
      ON factory_stage_runs(work_order_id, status);

    CREATE TABLE IF NOT EXISTS factory_outputs (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      stage_run_id TEXT DEFAULT NULL,
      entity_kind TEXT NOT NULL,
      supersedes_entity_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (work_order_id) REFERENCES factory_work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_run_id) REFERENCES factory_stage_runs(id) ON DELETE SET NULL,
      FOREIGN KEY (supersedes_entity_id) REFERENCES factory_outputs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_factory_outputs_work_order_kind_created
      ON factory_outputs(work_order_id, entity_kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_factory_outputs_stage_run
      ON factory_outputs(stage_run_id);
    CREATE INDEX IF NOT EXISTS idx_factory_outputs_supersedes
      ON factory_outputs(supersedes_entity_id);

    CREATE TABLE IF NOT EXISTS factory_composition_assets (
      composition_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      PRIMARY KEY (composition_id, asset_id),
      FOREIGN KEY (composition_id) REFERENCES factory_outputs(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES factory_outputs(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_composition_assets_ordinal
      ON factory_composition_assets(composition_id, ordinal);
    CREATE INDEX IF NOT EXISTS idx_factory_composition_assets_asset
      ON factory_composition_assets(asset_id);

    CREATE TABLE IF NOT EXISTS factory_checkpoints (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      stage_run_id TEXT DEFAULT NULL,
      resume_from_stage_key TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT DEFAULT NULL,
      snapshot_json TEXT NOT NULL,
      FOREIGN KEY (work_order_id) REFERENCES factory_work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_run_id) REFERENCES factory_stage_runs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_factory_checkpoints_work_order_created
      ON factory_checkpoints(work_order_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_factory_checkpoints_work_order_consumed
      ON factory_checkpoints(work_order_id, consumed_at);

    CREATE TABLE IF NOT EXISTS factory_events (
      id TEXT PRIMARY KEY,
      work_order_id TEXT NOT NULL,
      stage_run_id TEXT DEFAULT NULL,
      sequence INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (work_order_id) REFERENCES factory_work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_run_id) REFERENCES factory_stage_runs(id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_events_work_order_sequence
      ON factory_events(work_order_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_factory_events_work_order_created
      ON factory_events(work_order_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_factory_events_stage_run_created
      ON factory_events(stage_run_id, created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expiration_time INTEGER DEFAULT NULL,
      p256dh_key TEXT NOT NULL,
      auth_key TEXT NOT NULL,
      user_agent TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_notified_at TEXT DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_updated ON push_subscriptions(updated_at);
  `);
}
