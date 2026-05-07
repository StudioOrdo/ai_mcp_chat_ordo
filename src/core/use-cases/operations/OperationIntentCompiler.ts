import type {
  OperationIntentCompilerInput,
} from "@/core/use-cases/operations/OperationIntent";

export interface OperationIntentCompiler {
  compile(input: OperationIntentCompilerInput): Promise<unknown> | unknown;
}
