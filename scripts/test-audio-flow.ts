/**
 * Diagnostic script to test audio generation and retrieval flow
 */

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { UserFileSystem } from "@/lib/user-files";
import { generateStoredAudioArtifact, buildGenerateAudioRuntimePayload, resolveCanonicalGeneratedAudioAssetId } from "@/lib/audio/audio-generation-service";
import { getDb } from "@/lib/db";

const TEST_USER_ID = "test-user-diagnostic";
const TEST_TEXT = "This is a diagnostic audio test message for the AudioPlayer error investigation.";

async function runDiagnostic() {
  console.log("🔍 Starting audio flow diagnostic...\n");

  try {
    // Ensure test user exists
    console.log("🔧 Setup: Creating test user if needed...");
    const db = getDb();
    db.prepare(`INSERT OR IGNORE INTO users (id, email, name) VALUES (?, ?, ?)`)
      .run(TEST_USER_ID, `${TEST_USER_ID}@test.local`, "Diagnostic User");
    console.log("✅ Test user ready\n");
    // Step 1: Generate audio
    console.log("📝 Step 1: Generating audio artifact...");
    const artifact = await generateStoredAudioArtifact({
      userId: TEST_USER_ID,
      text: TEST_TEXT,
      conversationId: null,
    });
    console.log(`✅ Generated audio artifact:`, {
      assetId: artifact.assetId,
      provider: artifact.provider,
      cacheHit: artifact.cacheHit,
      sizeBytes: artifact.audioBuffer.byteLength,
    });

    // Step 2: Build runtime payload
    console.log("\n📝 Step 2: Building runtime payload...");
    const payload = buildGenerateAudioRuntimePayload(
      { title: "Test Audio", text: TEST_TEXT },
      artifact,
    );
    console.log(`✅ Runtime payload:`, {
      assetId: payload.assetId,
      assetKind: payload.assetKind,
      generationStatus: payload.generationStatus,
      provider: payload.provider,
    });

    // Step 3: Validate assetId format
    console.log("\n📝 Step 3: Validating assetId format...");
    const validated = resolveCanonicalGeneratedAudioAssetId(payload.assetId);
    console.log(`✅ Canonical assetId: ${validated}`);
    console.log(`   Is valid: ${validated === payload.assetId}`);

    // Step 4: Simulate JSON serialization/deserialization (like message parts)
    console.log("\n📝 Step 4: Testing JSON serialization...");
    const serialized = JSON.stringify(payload);
    const deserialized = JSON.parse(serialized);
    console.log(`✅ After roundtrip:`, {
      assetId: deserialized.assetId,
      assetIdType: typeof deserialized.assetId,
      assetIdIsNull: deserialized.assetId === null,
      assetIdIsString: typeof deserialized.assetId === "string",
    });

    // Step 5: Verify file exists in database
    console.log("\n📝 Step 5: Verifying file in database...");
    const repo = getUserFileDataMapper();
    const ufs = new UserFileSystem(repo);
    const result = await ufs.getById(artifact.assetId);
    console.log(`✅ File lookup:`, {
      found: !!result,
      userId: result?.file.userId,
      fileName: result?.file.fileName,
      fileSize: result?.file.fileSize,
    });

    // Step 6: Test URL encoding (like AudioPlayer does)
    console.log("\n📝 Step 6: Testing URL encoding...");
    if (!payload.assetId) {
      throw new Error("Generated audio payload did not include an assetId.");
    }

    const encoded = encodeURIComponent(payload.assetId);
    console.log(`✅ URL encoding:`, {
      original: payload.assetId,
      encoded: encoded,
      wouldMatch: encoded === payload.assetId,
    });

    console.log("\n✨ Diagnostic complete!");
  } catch (error) {
    console.error("❌ Error during diagnostic:", error);
  }
}

runDiagnostic();
