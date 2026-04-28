import { describe, it, expect } from "vitest";
import {
  extractControlTags,
  normalizeSuggestions,
  deriveResponseState,
  SUGGESTIONS_MARKER,
  ACTIONS_MARKER,
} from "../src/lib/chat/StreamControlTagParser";

describe("StreamControlTagParser", () => {
  describe("extractControlTags", () => {
    it("Positive: Extracts valid array payloads and leaves text", () => {
      const input = `Here are some ideas. ${SUGGESTIONS_MARKER} ["A", "B"]`;
      const result = extractControlTags(input);
      expect(result.text).toBe("Here are some ideas.");
      expect(result.suggestionsPayload).toEqual(["A", "B"]);
      expect(result.actionsPayload).toEqual([]);
    });

    it("Negative: Falls back to empty array on malformed JSON without throwing", () => {
      const input = `Broken json. ${SUGGESTIONS_MARKER} ["A", "B`;
      const result = extractControlTags(input);
      expect(result.text).toBe("Broken json.");
      expect(result.suggestionsPayload).toEqual([]);
    });

    it("Edge Case: Extracts overlapping markers correctly", () => {
      const input = `Text ${ACTIONS_MARKER} [{"type": "send"}] ${SUGGESTIONS_MARKER} ["C"]`;
      const result = extractControlTags(input);
      expect(result.text).toBe("Text");
      expect(result.suggestionsPayload).toEqual(["C"]);
      expect(result.actionsPayload).toEqual([{ type: "send" }]);
    });

    it("Edge Case: Empty payloads process correctly", () => {
      const input = `Empty ${SUGGESTIONS_MARKER} []`;
      const result = extractControlTags(input);
      expect(result.text).toBe("Empty");
      expect(result.suggestionsPayload).toEqual([]);
    });
  });
});
