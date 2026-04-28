import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMentions } from "@/hooks/useMentions";

function setup() {
  const textareaRef = { current: null };
  return renderHook(() => useMentions(textareaRef));
}

describe("insertMention – pure function (no DOM reads)", () => {
  it("CCH-T270: inserts @ mention and clears trigger state", () => {
    const { result } = setup();

    // Activate trigger
    act(() => { result.current.handleInput("@ben", 4); });
    expect(result.current.activeTrigger?.char).toBe("@");

    // Insert mention
    let newText = "";
    act(() => {
      newText = result.current.insertMention(
        { id: "benedict", name: "Benedict", category: "practitioner" },
        "@ben",
        4,
      );
    });

    expect(newText).toBe("@Benedict ");
    expect(result.current.activeTrigger).toBeNull();
    expect(result.current.suggestions).toEqual([]);
  });

  it("CCH-T272: inserts [[ mention with closing brackets", () => {
    const { result } = setup();

    act(() => { result.current.handleInput("see [[Chap", 10); });
    expect(result.current.activeTrigger?.char).toBe("[[");

    let newText = "";
    act(() => {
      newText = result.current.insertMention(
        { id: "ch1", name: "Chapter 1", category: "chapter" },
        "see [[Chap",
        10,
      );
    });

    expect(newText).toBe("see [[Chapter 1]] ");
  });

  it("CCH-T274: inserts # mention without brackets", () => {
    const { result } = setup();

    act(() => { result.current.handleInput("#fra", 4); });
    expect(result.current.activeTrigger?.char).toBe("#");

    let newText = "";
    act(() => {
      newText = result.current.insertMention(
        { id: "f1", name: "Deliberate Practice", category: "framework" },
        "#fra",
        4,
      );
    });

    expect(newText).toBe("#Deliberate Practice ");
  });

  it("CCH-T276: preserves text after cursor", () => {
    const { result } = setup();

    act(() => { result.current.handleInput("Hello @ben world", 10); });

    let newText = "";
    act(() => {
      newText = result.current.insertMention(
        { id: "benedict", name: "Benedict", category: "practitioner" },
        "Hello @ben world",
        10,
      );
    });

    expect(newText).toBe("Hello @Benedict  world");
  });

  it("CCH-T278: returns empty string when no active trigger", () => {
    const { result } = setup();

    // No trigger activated
    let newText = "";
    act(() => {
      newText = result.current.insertMention(
        { id: "benedict", name: "Benedict", category: "practitioner" },
        "hello",
        5,
      );
    });

    expect(newText).toBe("");
  });

  it("CCH-T280: inserts at the beginning of text", () => {
    const { result } = setup();

    act(() => { result.current.handleInput("@te", 3); });

    let newText = "";
    act(() => {
      newText = result.current.insertMention(
        { id: "teresa", name: "Teresa", category: "practitioner" },
        "@te",
        3,
      );
    });

    expect(newText).toBe("@Teresa ");
  });

  it("CCH-T282: works with empty query (just the trigger char)", () => {
    const { result } = setup();

    act(() => { result.current.handleInput("@", 1); });
    expect(result.current.activeTrigger?.char).toBe("@");

    let newText = "";
    act(() => {
      newText = result.current.insertMention(
        { id: "benedict", name: "Benedict", category: "practitioner" },
        "@",
        1,
      );
    });

    expect(newText).toBe("@Benedict ");
  });
});
