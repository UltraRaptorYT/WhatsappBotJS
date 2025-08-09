import { NextRequest } from "next/server";

// reuse the same in-memory store from the other file
const anyGlobal = globalThis as any;
if (!anyGlobal.__LOG_STREAMS__)
  anyGlobal.__LOG_STREAMS__ = new Map<
    string,
    { logs: string[]; listeners: Set<(line: string) => void> }
  >();
const logStreams: Map<
  string,
  { logs: string[]; listeners: Set<(line: string) => void> }
> = anyGlobal.__LOG_STREAMS__;

// tiny helper so both routes share storage
function getStore(jobId: string) {
  if (!logStreams.has(jobId))
    logStreams.set(jobId, { logs: [], listeners: new Set() });
  return logStreams.get(jobId)!;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const store = getStore(jobId);

  // send backlog
  for (const l of store.logs) {
    await writer.write(enc.encode(`data: ${l}\n\n`));
  }

  const listener = async (line: string) => {
    await writer.write(enc.encode(`data: ${line}\n\n`));
  };

  store.listeners.add(listener);

  // keep-alive
  const ka = setInterval(async () => {
    await writer.write(enc.encode(`:\n\n`));
  }, 15000);

  const close = () => {
    clearInterval(ka);
    store.listeners.delete(listener);
    writer.close();
  };

  // when client disconnects
  req.signal.addEventListener("abort", close);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
