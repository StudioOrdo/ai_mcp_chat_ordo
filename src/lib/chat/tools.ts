import type Anthropic from "@anthropic-ai/sdk";
import type { RoleName } from "@/core/entities/user";
import { getAgentPlatformFacade } from "@/lib/platform/agent-platform-facade-root";

export { getToolComposition } from "@/lib/chat/tool-composition-root";

export function getToolsForRole(role: RoleName): Anthropic.Tool[] {
  return getAgentPlatformFacade().getExecutionSurface().registry.getPromptVisibleSchemasForRole(role, {
    mode: role === "ADMIN" ? "operator_chat" : "default_chat",
  }) as Anthropic.Tool[];
}
