import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import type { Command } from "@/core/commands/Command";
import type { MentionItem } from "@/core/entities/mentions";
import {
  createCommandMentions,
  createShellCommands,
  resolveShellCommandDefinitions,
} from "@/lib/shell/shell-commands";
import { useShellNavigationContext } from "@/lib/shell/ShellNavigationContextProvider";

export function useCommandRegistry() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const navigationContext = useShellNavigationContext();

  const commands = useMemo<Command[]>(
    () =>
      createShellCommands({
        navigate: (path) => router.push(path),
        setTheme,
        navigationContext,
      }),
    [router, setTheme, navigationContext],
  );

  const mentions = useMemo<MentionItem[]>(
    () => createCommandMentions(resolveShellCommandDefinitions({ navigationContext })),
    [navigationContext],
  );

  const executeCommand = useCallback(
    (commandId: string) => {
      const command = commands.find((candidate) => candidate.id === commandId);
      if (!command) {
        return false;
      }

      command.execute();
      return true;
    },
    [commands],
  );

  const findCommands = useCallback(
    (query: string) => {
      const normalizedQuery = query.toLowerCase();
      return mentions.filter(
        (command) =>
          command.name.toLowerCase().includes(normalizedQuery) ||
          command.description?.toLowerCase().includes(normalizedQuery) ||
          command.id.toLowerCase().includes(normalizedQuery),
      );
    },
    [mentions],
  );

  return {
    executeCommand,
    findCommands,
  };
}
