import type { OperationIntentCompiler } from "@/core/use-cases/operations/OperationIntentCompiler";
import type { OperationIntentRouter } from "@/core/use-cases/operations/OperationIntentRouter";
import type {
  OperationIntentCompilerInput,
  OperationIntentRouteResult,
} from "@/core/use-cases/operations/OperationIntent";
import {
  OperationIntentSchemaError,
  parseOperationIntentCompilerOutput,
} from "@/lib/operations/operation-intent-schema";
import { projectOperationIntentResult } from "@/lib/operations/operation-intent-projection";

export interface OperationIntentIngressDeps {
  compiler: OperationIntentCompiler;
  router: Pick<OperationIntentRouter, "route">;
  project?: (result: OperationIntentRouteResult) => string | null;
}

export interface OperationIntentIngressResult {
  handled: boolean;
  replyText: string | null;
  routeResult: OperationIntentRouteResult;
}

export class OperationIntentIngress {
  private readonly project: (result: OperationIntentRouteResult) => string | null;

  constructor(private readonly deps: OperationIntentIngressDeps) {
    this.project = deps.project ?? projectOperationIntentResult;
  }

  async handle(input: OperationIntentCompilerInput): Promise<OperationIntentIngressResult> {
    const rawOutput = await this.deps.compiler.compile(input);
    let parsedOutput;
    try {
      parsedOutput = parseOperationIntentCompilerOutput(rawOutput);
    } catch (error) {
      const message = error instanceof OperationIntentSchemaError
        ? "I could not validate the operation plan safely. Please restate the operation with exact ids and intent."
        : "I could not inspect that operation request safely. Please try again.";
      return {
        handled: true,
        replyText: message,
        routeResult: {
          kind: "rejected_response",
          message,
        },
      };
    }

    if (parsedOutput.kind === "pass_through") {
      return {
        handled: false,
        replyText: null,
        routeResult: {
          kind: "pass_through",
          confidence: parsedOutput.confidence,
          reason: parsedOutput.reason,
        },
      };
    }

    const routeResult = await this.deps.router.route({
      compilerInput: input,
      compilerOutput: parsedOutput,
    });

    if (routeResult.kind === "pass_through") {
      return {
        handled: false,
        replyText: null,
        routeResult,
      };
    }

    return {
      handled: true,
      replyText: this.project(routeResult) ?? "",
      routeResult,
    };
  }
}

export async function detectDirectTurnOperationIntent(input: {
  compiler: OperationIntentCompiler;
  compilerInput: OperationIntentCompilerInput;
}): Promise<string | null> {
  let parsedOutput;
  try {
    parsedOutput = parseOperationIntentCompilerOutput(await input.compiler.compile(input.compilerInput));
  } catch {
    return "That request needs a conversation-backed operation surface so Ordo can validate it before any work happens.";
  }

  if (parsedOutput.kind === "pass_through") {
    return null;
  }

  return "That request needs a conversation-backed operation so Ordo can create durable state, confirmations, and audit evidence. Use the conversation or admin surface for backup, restore, media, factory, publish, and other operation-backed work.";
}
