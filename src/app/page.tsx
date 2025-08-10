"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setSubmitting(true);
    setLogs((l) => [...l, "Starting job..."]);

    // revoke old screenshot
    if (imageUrl && imageUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);

    try {
      const fd = new FormData(formRef.current);
      const res = await fetch(
        `/api/send?url=${encodeURIComponent("https://web.whatsapp.com/")}`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        setLogs((l) => [...l, "Start failed"]);
        return;
      }
      const { jobId } = await res.json();
      setJobId(jobId);
      setLogs((l) => [...l, `Job started: ${jobId}`]);
    } catch (err: any) {
      setLogs((l) => [...l, `Error: ${err?.message || err}`]);
    } finally {
      setSubmitting(false);
    }
  };

  // Stream logs + image via SSE
  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(
      `/api/send/logs?jobId=${encodeURIComponent(jobId)}`
    );

    es.onmessage = (ev) => setLogs((l) => [...l, ev.data]);

    es.addEventListener("image", (ev: MessageEvent) => {
      const b64 = ev.data as string;
      setImageUrl(`data:image/png;base64,${b64}`);
    });

    es.onerror = () => {
      setLogs((l) => [...l, "Log stream closed"]);
      es.close();
    };
    return () => es.close();
  }, [jobId]);

  // Cleanup blob URL when unmounting
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    const root = logsContainerRef.current;
    if (!root) return;
    root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const clearLogs = () => setLogs([]);

  return (
    <div className="container mx-auto max-w-7xl p-6 flex min-h-[100dvh]">
      {/* Two-column layout: left form/logs, right screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: form + logs */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>WhatsApp Mass Sender</CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={onSubmit} className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="namelist">
                  Excel (.xlsx) with “Mobile Number” column
                </Label>
                <Input
                  id="namelist"
                  name="namelist"
                  type="file"
                  accept=".xlsx"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="message">Message Template (.txt)</Label>
                <Input
                  id="message"
                  name="message"
                  type="file"
                  accept=".txt"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="images">
                  Optional Images (png, jpg, jpeg, gif, bmp, ico, webp)
                </Label>
                <Input
                  id="images"
                  name="images"
                  type="file"
                  multiple
                  accept=".png,.jpg,.jpeg,.gif,.bmp,.ico,.webp"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="document">Optional Document</Label>
                <Input id="document" name="document" type="file" />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Starting..." : "Send Message"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => formRef.current?.reset()}
                >
                  Reset
                </Button>
                <Button type="button" variant="outline" onClick={clearLogs}>
                  Clear Logs
                </Button>
              </div>
            </form>

            <Separator className="my-6" />

            <div className="grid gap-2">
              <Label>Logs</Label>
              <div>
                <ScrollArea
                  className="max-h-72 overflow-y-auto rounded-md border"
                  ref={logsContainerRef}
                >
                  <pre className="p-4 text-sm whitespace-pre-wrap break-words">
                    {logs.length ? logs.join("\n") : "Logs will appear here..."}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            {jobId ? `Job ID: ${jobId}` : "No active job"}
          </CardFooter>
        </Card>

        {/* RIGHT: big screenshot panel */}
        <Card className="shadow-lg lg:sticky lg:top-6 self-start h-full w-full col-span-2">
          <CardHeader>
            <CardTitle>Screenshot Result</CardTitle>
          </CardHeader>
          <CardContent className="my-auto">
            <div className="rounded border overflow-hidden bg-black/5">
              <div className="aspect-video w-full">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Result screenshot"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                    {jobId
                      ? "Waiting for screenshot..."
                      : "Start a job to see the screenshot here."}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
