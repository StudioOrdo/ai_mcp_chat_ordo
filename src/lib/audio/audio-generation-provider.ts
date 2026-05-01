import type {
  GenerateStoredAudioInput,
  StoredAudioArtifact,
} from "@/lib/audio/audio-generation-service";
import { generateStoredAudioArtifact } from "@/lib/audio/audio-generation-service";

export interface AudioGenerationProvider {
  generate(input: GenerateStoredAudioInput): Promise<StoredAudioArtifact>;
}

export const defaultAudioGenerationProvider: AudioGenerationProvider = {
  generate: generateStoredAudioArtifact,
};
