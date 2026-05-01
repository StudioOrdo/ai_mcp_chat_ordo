import { LoggingMiddleware } from "@/core/tool-registry/LoggingMiddleware";
import type { ChatRuntimeHook } from "@/lib/chat/runtime-hooks";
import { MediaWorkflowTurnHook } from "@/lib/media/workflows/media-workflow-turn-hook";

export function getChatRuntimeHooks(): readonly ChatRuntimeHook[] {
  return [new LoggingMiddleware(), new MediaWorkflowTurnHook()];
}
