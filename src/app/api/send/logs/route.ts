import { NextRequest } from "next/server";
import { subscribe } from "@/lib/demoStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  const unsub = subscribe(jobId, async (line) => {
    try {
      if (line.startsWith("__IMAGE_JPEG_BASE64__:")) {
        const b64 = line.slice("__IMAGE_JPEG_BASE64__:".length);
        await writer.write(enc.encode(`event: image\ndata: ${b64}\n\n`));
      } else if (line.startsWith("__IMAGE_PNG_BASE64__:")) {
        const b64 = line.slice("__IMAGE_PNG_BASE64__:".length);
        await writer.write(enc.encode(`event: image\ndata: ${b64}\n\n`));
      } else {
        await writer.write(enc.encode(`data: ${line}\n\n`));
      }
    } catch {}
  });

  const ping = setInterval(() => {
    writer.write(enc.encode(`:\n\n`)).catch(() => {});
  }, 15000);

  const close = () => {
    clearInterval(ping);
    unsub();
    try {
      writer.close();
    } catch {}
  };

  // @ts-ignore
  req.signal?.addEventListener?.("abort", close);

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
