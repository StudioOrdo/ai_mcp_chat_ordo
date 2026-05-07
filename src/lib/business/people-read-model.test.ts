import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";

import { ensureSchema } from "@/lib/db/schema";

import { loadPeopleReadModel } from "./people-read-model";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

function seedUser(db: Database.Database, id: string, roleId = "role_authenticated", name = id) {
  db.prepare(`INSERT INTO users (id, email, name) VALUES (?, ?, ?)`).run(id, `${id}@example.com`, name);
  db.prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`).run(id, roleId);
}

function seedConversation(
  db: Database.Database,
  input: {
    id: string;
    userId: string;
    title?: string;
    updatedAt?: string;
    need?: string | null;
    nextStep?: string | null;
  },
) {
  db.prepare(
    `INSERT INTO conversations (
       id, user_id, title, status, created_at, updated_at, message_count,
       session_source, lane, detected_need_summary, recommended_next_step
     ) VALUES (?, ?, ?, 'active', ?, ?, 1, 'authenticated', 'individual', ?, ?)`,
  ).run(
    input.id,
    input.userId,
    input.title ?? input.id,
    input.updatedAt ?? "2026-05-04T12:00:00.000Z",
    input.updatedAt ?? "2026-05-04T12:00:00.000Z",
    input.need ?? null,
    input.nextStep ?? null,
  );
}

describe("people read model", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
    seedUser(db, "usr_owner", "role_authenticated", "Owner");
    seedUser(db, "usr_other", "role_authenticated", "Other");
    seedUser(db, "usr_anon", "role_anonymous", "Anonymous");
  });

  it("derives anonymous, known, interested, offer, and purchased stages from durable evidence", async () => {
    seedConversation(db, {
      id: "conv_anon",
      userId: "usr_anon",
      title: "Anonymous chat",
      updatedAt: "2026-05-01T12:00:00.000Z",
    });
    db.prepare(
      `INSERT INTO referrals (id, referrer_user_id, conversation_id, referral_code, status, created_at, last_event_at)
       VALUES ('ref_anon', 'usr_owner', 'conv_anon', 'OWNER', 'visited', '2026-05-01T12:00:00.000Z', '2026-05-01T12:05:00.000Z')`,
    ).run();

    seedConversation(db, {
      id: "conv_owner_1",
      userId: "usr_owner",
      title: "Owner chat",
      updatedAt: "2026-05-02T12:00:00.000Z",
    });

    seedConversation(db, {
      id: "conv_lead",
      userId: "usr_owner",
      title: "Lead chat",
      updatedAt: "2026-05-03T12:00:00.000Z",
      need: "Needs a launch process.",
      nextStep: "Send offer.",
    });
    db.prepare(
      `INSERT INTO lead_records (
         id, conversation_id, lane, name, email, organization, problem_summary,
         recommended_next_action, capture_status, triage_state, created_at, updated_at
       ) VALUES (
         'lead_1', 'conv_lead', 'organization', 'Avery', 'avery@example.com',
         'Avery Co', 'Needs a launch process.', 'Send offer.', 'submitted',
         'new', '2026-05-03T12:00:00.000Z', '2026-05-03T12:10:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO consultation_requests (id, conversation_id, user_id, lane, request_summary, status, created_at, updated_at)
       VALUES ('cr_1', 'conv_lead', 'usr_owner', 'organization', 'Wants implementation help.', 'pending', '2026-05-03T12:20:00.000Z', '2026-05-03T12:20:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO deal_records (
         id, conversation_id, consultation_request_id, lead_record_id, user_id,
         lane, title, organization_name, problem_summary, proposed_scope,
         recommended_service_type, estimated_price, status, next_action,
         created_at, updated_at
       ) VALUES (
         'deal_1', 'conv_lead', 'cr_1', 'lead_1', 'usr_owner',
         'organization', 'Launch plan', 'Avery Co', 'Needs a launch process.',
         'Build the process.', 'strategy', 50000, 'draft', 'Review scope.',
         '2026-05-03T12:30:00.000Z', '2026-05-03T12:30:00.000Z'
       )`,
    ).run();

    db.prepare(
      `INSERT INTO offers (
         id, slug, owner_user_id, title, summary, description, audience, promise,
         price_cents, currency, billing_kind, estimated_minutes, status, visibility,
         cta_label, created_at, updated_at
       ) VALUES (
         'offer_1', 'launch-plan', 'usr_owner', 'Launch Plan', 'A plan.',
         'A plan.', 'Solopreneurs', 'Clear launch.', 50000, 'USD', 'fixed',
         90, 'published', 'public', 'Start', '2026-05-03T13:00:00.000Z',
         '2026-05-03T13:00:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO offer_events (id, offer_id, event_type, person_ref, conversation_id, metadata_json, created_at)
       VALUES ('offer_evt_sent', 'offer_1', 'sent_private', 'person:lead_1', 'conv_lead', '{}', '2026-05-03T13:05:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO offer_events (id, offer_id, event_type, person_ref, conversation_id, metadata_json, created_at)
       VALUES ('offer_evt_viewed', 'offer_1', 'viewed', 'person:lead_1', 'conv_lead', '{}', '2026-05-03T13:08:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO offer_events (id, offer_id, event_type, person_ref, conversation_id, metadata_json, created_at)
       VALUES ('offer_evt_chosen', 'offer_1', 'chosen', 'person:lead_1', 'conv_lead', '{}', '2026-05-03T13:10:00.000Z')`,
    ).run();
    db.prepare(
      `INSERT INTO offer_events (id, offer_id, event_type, person_ref, conversation_id, metadata_json, created_at)
       VALUES ('offer_evt_purchase', 'offer_1', 'purchase_simulated', 'person:lead_1', 'conv_lead', '{}', '2026-05-03T13:20:00.000Z')`,
    ).run();

    const people = await loadPeopleReadModel("usr_owner", { db });

    expect(people).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "person:conversation:conv_anon",
        stageLabel: "Visitor",
        displayName: "Referred visitor",
        isAnonymous: true,
      }),
      expect.objectContaining({
        id: "person:user:usr_owner",
        stageLabel: "Contact",
        displayName: "Owner",
      }),
      expect.objectContaining({
        id: "person:email:avery@example.com",
        stage: "purchased_simulated",
        stageLabel: "Purchased",
        displayName: "Avery",
        email: "avery@example.com",
        organization: "Avery Co",
        sourceLabels: expect.arrayContaining(["Direct conversation", "Public offer"]),
        sourceCategories: expect.arrayContaining(["direct_conversation", "public_offer"]),
        offerLabels: ["Launch Plan"],
        relationshipRole: "Customer",
        leadIds: ["lead_1"],
        consultationRequestIds: ["cr_1"],
        dealIds: ["deal_1"],
        offerIds: ["offer_1"],
      }),
    ]));
    const averyTrail = people.find((person) => person.id === "person:email:avery@example.com")?.relationshipTrail ?? [];
    expect(averyTrail.map((item) => item.label)).toEqual([
      "Conversation started",
      "Contact captured",
      "Owner action taken",
      "Owner action taken",
      "Offer sent",
      "Offer viewed",
      "Offer accepted",
      "Purchase simulated",
    ]);
    expect(averyTrail.map((item) => item.occurredAt)).toEqual([...averyTrail.map((item) => item.occurredAt)].sort());
    expect(averyTrail.filter((item) => item.label.startsWith("Brief"))).toHaveLength(0);
    expect(averyTrail.find((item) => item.label === "Offer viewed")).toMatchObject({
      sourceRef: expect.objectContaining({ href: "/offers/launch-plan" }),
      sourceActionLabel: "View offer",
    });
  });

  it("projects QR, referral, and public content tracked-link evidence into human relationship trail events", async () => {
    seedConversation(db, {
      id: "conv_content",
      userId: "usr_owner",
      title: "Content follow-up",
      updatedAt: "2026-05-02T12:00:00.000Z",
    });
    db.prepare(
      `INSERT INTO referrals (
         id, referrer_user_id, conversation_id, referral_code, status,
         scanned_at, created_at, last_event_at
       ) VALUES (
         'ref_qr', 'usr_owner', 'conv_content', 'OWNER', 'visited',
         '2026-05-01T12:05:00.000Z', '2026-05-01T12:00:00.000Z',
         '2026-05-01T12:05:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO blog_posts (
         id, slug, title, description, content, status, published_at,
         created_by_user_id, published_by_user_id, created_at, updated_at
       ) VALUES (
         'blogpost_1', 'launch-note', 'Launch Note', 'A public note.',
         'Launch content.', 'published', '2026-05-01T13:00:00.000Z',
         'usr_owner', 'usr_owner', '2026-05-01T13:00:00.000Z',
         '2026-05-01T13:00:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO tracked_links (
         id, code, owner_user_id, target_kind, target_id, destination_url,
         label, purpose, status, created_from_conversation_id, created_at, updated_at
       ) VALUES (
         'tl_content', 'CONTENT1', 'usr_owner', 'content_item', 'blogpost_1',
         '/feed/launch-note?tl=CONTENT1', 'Launch Note QR', 'content',
         'active', 'conv_content', '2026-05-01T13:00:00.000Z',
         '2026-05-01T13:00:00.000Z'
       )`,
    ).run();
    db.prepare(
      `INSERT INTO tracked_link_events (
         id, tracked_link_id, event_type, conversation_id, created_at
       ) VALUES (
         'tle_content_visit', 'tl_content', 'visit', 'conv_content',
         '2026-05-02T10:00:00.000Z'
       )`,
    ).run();

    const people = await loadPeopleReadModel("usr_owner", { db });
    const person = people.find((item) => item.id === "person:conversation:conv_content");

    expect(person?.sourceLabels).toEqual(expect.arrayContaining(["QR code", "Public content"]));
    expect(person?.sourceCategories).toEqual(expect.arrayContaining(["qr_code", "public_content"]));
    expect(person?.relationshipTrail).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "First visit",
        summary: "Visited through referral OWNER.",
      }),
      expect.objectContaining({
        label: "QR / referral source",
        summary: "QR code recorded for referral OWNER.",
        sourceRef: expect.objectContaining({ href: "/business/referrals/OWNER" }),
        sourceActionLabel: "Open referral",
      }),
      expect.objectContaining({
        label: "Public content viewed",
        summary: "Launch Note was viewed.",
        sourceRef: expect.objectContaining({ href: "/studio/content/blogpost_1" }),
        sourceActionLabel: "View content",
      }),
    ]));
    expect(JSON.stringify(person)).not.toContain("tracked_link_events");
    expect(JSON.stringify(person)).not.toContain("offer_events");
    expect(JSON.stringify(person)).not.toContain("job_events");
  });

  it("does not leak other owner people or invent anonymous PII", async () => {
    seedConversation(db, { id: "conv_other", userId: "usr_other", title: "Other user lead" });
    db.prepare(
      `INSERT INTO lead_records (id, conversation_id, lane, name, email, capture_status, triage_state)
       VALUES ('lead_other', 'conv_other', 'organization', 'Hidden', 'hidden@example.com', 'submitted', 'new')`,
    ).run();

    seedConversation(db, { id: "conv_anon", userId: "usr_anon", title: "Anonymous chat" });
    db.prepare(
      `INSERT INTO referrals (id, referrer_user_id, conversation_id, referral_code, status)
       VALUES ('ref_anon', 'usr_owner', 'conv_anon', 'OWNER', 'visited')`,
    ).run();

    const people = await loadPeopleReadModel("usr_owner", { db });

    expect(people.some((person) => person.displayName === "Hidden")).toBe(false);
    const anonymous = people.find((person) => person.id === "person:conversation:conv_anon");
    expect(anonymous).toMatchObject({
      stageLabel: "Visitor",
      displayName: "Referred visitor",
      isAnonymous: true,
    });
    expect(JSON.stringify(anonymous)).not.toContain("hidden@example.com");
  });

  it("does not advance a priced deal to offer without an offer event", async () => {
    seedConversation(db, { id: "conv_deal", userId: "usr_owner", title: "Deal chat" });
    db.prepare(
      `INSERT INTO lead_records (id, conversation_id, lane, name, capture_status, triage_state)
       VALUES ('lead_no_offer', 'conv_deal', 'organization', 'No Offer', 'submitted', 'new')`,
    ).run();
    db.prepare(
      `INSERT INTO deal_records (
         id, conversation_id, lead_record_id, user_id, lane, title,
         problem_summary, proposed_scope, recommended_service_type, estimated_price, status
       ) VALUES (
         'deal_no_offer', 'conv_deal', 'lead_no_offer', 'usr_owner',
         'organization', 'Priced scope', 'Need help.', 'Scope.', 'strategy',
         100000, 'draft'
       )`,
    ).run();

    const people = await loadPeopleReadModel("usr_owner", { db });

    expect(people.find((person) => person.id === "person:lead:lead_no_offer")).toMatchObject({
      stage: "interested",
      stageLabel: "Conversation",
    });
  });

  it("merges multiple conversations for the same authenticated user and marks stale no-action conversations for follow-up", async () => {
    seedConversation(db, { id: "conv_a", userId: "usr_owner", title: "First chat", updatedAt: "2026-05-01T12:00:00.000Z" });
    seedConversation(db, { id: "conv_b", userId: "usr_owner", title: "Second chat", updatedAt: "2026-05-02T12:00:00.000Z" });
    seedConversation(db, { id: "conv_stale", userId: "usr_anon", title: "Old anonymous chat", updatedAt: "2026-01-01T12:00:00.000Z" });
    db.prepare(
      `INSERT INTO referrals (id, referrer_user_id, conversation_id, referral_code, status, created_at)
       VALUES ('ref_stale', 'usr_owner', 'conv_stale', 'OWNER', 'visited', '2026-01-01T12:00:00.000Z')`,
    ).run();

    const people = await loadPeopleReadModel("usr_owner", {
      db,
      now: new Date("2026-05-05T12:00:00.000Z"),
    });

    expect(people.find((person) => person.id === "person:user:usr_owner")?.conversationIds.sort()).toEqual([
      "conv_a",
      "conv_b",
    ]);
    expect(people.find((person) => person.id === "person:conversation:conv_stale")).toMatchObject({
      stageLabel: "Follow-up",
    });
  });
});
