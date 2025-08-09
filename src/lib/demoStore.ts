type Listener = (line: string) => void;

const g = globalThis as any;
if (!g.__DEMO_STREAM__) g.__DEMO_STREAM__ = new Map<string, Set<Listener>>();
export const listeners: Map<string, Set<Listener>> = g.__DEMO_STREAM__;

export function appendLog(jobId: string, line: string) {
  const isImage =
    line.startsWith("__IMAGE_JPEG_BASE64__:") ||
    line.startsWith("__IMAGE_PNG_BASE64__:");
  const msg = isImage ? line : `[${new Date().toISOString()}] ${line}`;

  const set = listeners.get(jobId);
  if (!set) return;
  for (const fn of set) fn(msg);
}

export function subscribe(jobId: string, fn: Listener) {
  if (!listeners.has(jobId)) listeners.set(jobId, new Set());
  listeners.get(jobId)!.add(fn);
  return () => listeners.get(jobId)!.delete(fn);
}
