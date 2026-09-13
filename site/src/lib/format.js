// Small formatting helpers shared by server and client code.

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  return n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;
}
