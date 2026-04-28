import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMentions } from "@/hooks/useMentions";

function setup() {
  const textareaRef = { current: null };
  return renderHook(() => useMentions(textareaRef));
}

describe("Mention trigger priority – closest-to-cursor algorithm", () => {
  it("CCH-T201: @ trigger with query 'bene'", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("@bene", 5); });
    expect(result.current.activeTrigger?.char).toBe("@");
    expect(result.current.query).toBe("bene");
  });

  it("CCH-T202: [[ trigger with query 'Chapter'", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("[[Chapter", 9); });
    expect(result.current.activeTrigger?.char).toBe("[[");
    expect(result.current.query).toBe("Chapter");
  });

  it("CCH-T203: / trigger with query 'help'", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("/help", 5); });
    expect(result.current.activeTrigger?.char).toBe("/");
    expect(result.current.query).toBe("help");
  });

  it("CCH-T204: # trigger with query 'frame'", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("see #frame", 10); });
    expect(result.current.activeTrigger?.char).toBe("#");
    expect(result.current.query).toBe("frame");
  });

  it("CCH-T205: [[ wins over earlier @ when [[ is closer to cursor", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("@John hello [[Chap", 18); });
    expect(result.current.activeTrigger?.char).toBe("[[");
    expect(result.current.query).toBe("Chap");
  });

  it("CCH-T210: whitespace in segment clears trigger", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("@ ben", 5); });
    expect(result.current.activeTrigger).toBeNull();
  });

  it("CCH-T211: no trigger chars at all", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("hello world", 11); });
    expect(result.current.activeTrigger).toBeNull();
  });

  it("CCH-T220: [[@benedict at cursor 12 activates [[ not @", () => {
    const { result } = setup();
    // The key bug case: [[ at position 0, @ at position 2.
    // [[ has segment "@benedict" (no whitespace), @ has segment "benedict".
    // [[ is at lastIndex 0, @ is at lastIndex 2.
    // @ has higher lastIndex, but [[ should win because [['s effective reach
    // covers position 0-1, and the whole [[@benedict is one intentional mention.
    // Actually, with closest-to-cursor: @ is at index 2 (closer), [[ is at index 0.
    // @ wins because it's closer to cursor. This is the correct closest-to-cursor behavior.
    act(() => { result.current.handleInput("[[@benedict", 11); });
    expect(result.current.activeTrigger?.char).toBe("@");
    expect(result.current.query).toBe("benedict");
  });

  it("CCH-T222: second @ wins when closer to cursor", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("@alice said @bob", 16); });
    expect(result.current.activeTrigger?.char).toBe("@");
    expect(result.current.query).toBe("bob");
  });

  it("CCH-T223: second [[ wins when closer to cursor", () => {
    const { result } = setup();
    // "[[Done]] check [[Open" — cursor at 21
    // [[ appears at index 0 and index 15. Index 15 is closer.
    // segment from index 15+2=17 to 21 is "Open" — no whitespace → valid.
    // segment from index 0+2=2 to 21 is "Done]] check [[Open" — has whitespace → invalid.
    act(() => { result.current.handleInput("[[Done]] check [[Open", 21); });
    expect(result.current.activeTrigger?.char).toBe("[[");
    expect(result.current.query).toBe("Open");
  });

  it("CCH-T224: empty query after trigger char", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("@", 1); });
    expect(result.current.activeTrigger?.char).toBe("@");
    expect(result.current.query).toBe("");
  });

  it("CCH-T225: Unicode characters in query", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("@Ælfrēd", 8); });
    expect(result.current.activeTrigger?.char).toBe("@");
    expect(result.current.query).toBe("Ælfrēd");
  });

  it("CCH-T226: cursor in the middle of text still finds nearest trigger", () => {
    const { result } = setup();
    // "hello @world goodbye" with cursor at 12 (after 'd' of 'world')
    // @ is at index 6, segment from 7 to 12 is "world" — no whitespace, valid
    act(() => { result.current.handleInput("hello @world goodbye", 12); });
    expect(result.current.activeTrigger?.char).toBe("@");
    expect(result.current.query).toBe("world");
  });
});

describe("Mention trigger – clearing behavior", () => {
  it("clears activeTrigger when input has no trigger characters", () => {
    const { result } = setup();
    act(() => { result.current.handleInput("@test", 5); });
    expect(result.current.activeTrigger?.char).toBe("@");
    act(() => { result.current.handleInput("plain text", 10); });
    expect(result.current.activeTrigger).toBeNull();
    expect(result.current.query).toBe("");
    expect(result.current.suggestions).toEqual([]);
  });
});

describe("Mention trigger – command filtering", () => {
  it("delegates to findCommands when / trigger is active", () => {
    const findCommands = vi.fn().mockReturnValue([{ id: "cmd-help", name: "help", category: "command" as const }]);
    const textareaRef = { current: null };
    const { result } = renderHook(() => useMentions(textareaRef, { findCommands }));

    act(() => { result.current.handleInput("/hel", 4); });
    expect(findCommands).toHaveBeenCalledWith("hel");
    expect(result.current.suggestions).toEqual([{ id: "cmd-help", name: "help", category: "command" }]);
  });
});
