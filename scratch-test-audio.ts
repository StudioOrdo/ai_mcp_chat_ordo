import { generateStoredAudioArtifact } from "./src/lib/audio/audio-generation-service";
import fs from "fs";

async function run() {
  const envRaw = fs.readFileSync(".env.local", "utf-8");
  for (const line of envRaw.split("\n")) {
    const [key, ...vals] = line.split("=");
    if (key && vals.length > 0) {
      process.env[key.trim()] = vals.join("=").trim();
    }
  }

  try {
    const result = await generateStoredAudioArtifact({
      userId: "usr_test",
      text: "Testing audio generation error",
    });
    console.log("Success:", result.assetId);
  } catch (err: any) {
    console.error("Failed to generate audio:", err.message);
    if (err.cause) console.error("Cause:", err.cause);
  }
}

run();
