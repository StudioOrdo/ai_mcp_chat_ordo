import { useMemo } from "react";

import {
  createComposeMediaMaterialization,
  type ComposeMediaMaterialization,
  type ComposeMediaPlanResolution,
  type ComposeMediaPlanResolutionStage,
  type EnqueueComposeMediaRecoveryOptions,
  type StartComposeMediaRuntimeOptions,
  type UseComposeMediaMaterializationOptions,
  ComposeMediaDeferredEnqueueError,
} from "./composeMediaMaterializationCore";

export {
  ComposeMediaDeferredEnqueueError,
  type ComposeMediaMaterialization,
  type ComposeMediaPlanResolution,
  type ComposeMediaPlanResolutionStage,
  type EnqueueComposeMediaRecoveryOptions,
  type StartComposeMediaRuntimeOptions,
  type UseComposeMediaMaterializationOptions,
};

export function useComposeMediaMaterialization(
  options: UseComposeMediaMaterializationOptions,
): ComposeMediaMaterialization {
  const { assetResolutionIndex, conversationId } = options;

  return useMemo(
    () => createComposeMediaMaterialization({ assetResolutionIndex, conversationId }),
    [assetResolutionIndex, conversationId],
  );
}