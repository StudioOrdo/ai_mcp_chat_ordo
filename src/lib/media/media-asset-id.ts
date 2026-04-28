export function resolveCanonicalMediaAssetId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return /^(uf|asset)_[a-z0-9_-]+$/i.test(trimmed) ? trimmed : null;
}