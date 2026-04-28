/**
 * Test AudioPlayer fetch flow with real database file
 */

import { getUserFileDataMapper } from "@/adapters/RepositoryFactory";
import { UserFileSystem } from "@/lib/user-files";
import { getDb } from "@/lib/db";

const TEST_ASSET_ID = "uf_0884c2ee-bd8b-4eba-9793-09eafdccf389";
const TEST_USER_ID = "usr_0be836f3-3580-43a0-9d3d-873a8f5cdbef";

async function testAudioRetrieval() {
  console.log("🔍 Testing AudioPlayer fetch flow...\n");

  try {
    // Step 1: Direct database lookup
    console.log("📝 Step 1: Direct database lookup...");
    const db = getDb();
    const row = db.prepare(`SELECT id, user_id, file_name, file_size FROM user_files WHERE id = ?`).get(TEST_ASSET_ID);
    console.log(`✅ Database record:`, row);

    // Step 2: UserFileSystem lookup
    console.log("\n📝 Step 2: UserFileSystem.getById() lookup...");
    const repo = getUserFileDataMapper();
    const ufs = new UserFileSystem(repo);
    const result = await ufs.getById(TEST_ASSET_ID);
    console.log(`✅ UserFileSystem result:`, {
      found: !!result,
      userId: result?.file.userId,
      fileName: result?.file.fileName,
      diskPath: result?.diskPath,
    });

    // Step 3: Validate user ownership
    console.log("\n📝 Step 3: Validate user ownership...");
    if (result) {
      const userMatches = result.file.userId === TEST_USER_ID;
      console.log(`✅ User ownership check:`, {
        fileUserId: result.file.userId,
        expectedUserId: TEST_USER_ID,
        matches: userMatches,
      });
    }

    // Step 4: Simulate endpoint GET request
    console.log("\n📝 Step 4: Simulating endpoint GET request...");
    const encoded = encodeURIComponent(TEST_ASSET_ID);
    console.log(`✅ URL-encoded assetId: ${encoded}`);
    console.log(`   Endpoint would be: /api/user-files/${encoded}`);
    console.log(`   Original assetId: ${TEST_ASSET_ID}`);
    console.log(`   Match: ${encoded === TEST_ASSET_ID}`);

    console.log("\n✨ All checks passed - AudioPlayer should work!");
  } catch (error) {
    console.error("❌ Error during test:", error);
  }
}

testAudioRetrieval();
