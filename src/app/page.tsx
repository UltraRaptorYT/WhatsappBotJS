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
import { toast } from "sonner";

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
    toast.info("Starting job...");

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
        toast.error("Start failed");
        return;
      }
      const { jobId } = await res.json();
      setJobId(jobId);
      const msg = `[${new Date().toISOString()}] [SUCCESS] : Job started: ${jobId}`;
      setLogs((l) => [...l, msg]);
      toast.success(msg);
    } catch (err: any) {
      const msg = `[${new Date().toISOString()}] [ERROR] : ${
        err?.message || err
      }`;
      setLogs((l) => [...l, msg]);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(
      `/api/send/logs?jobId=${encodeURIComponent(jobId)}`
    );

    const isImageLine = (line: string) =>
      line.startsWith("__IMAGE_JPEG_BASE64__:") ||
      line.startsWith("__IMAGE_PNG_BASE64__:");

    es.onmessage = (ev) => {
      const line: string = ev.data;
      setLogs((l) => [...l, line]);

      if (isImageLine(line)) return;

      // Parse "[timestamp] [LEVEL] : message"
      const message = line.includes(" : ")
        ? line.split(" : ").slice(-1)[0]
        : line;

      const upper = line.toUpperCase();
      if (upper.includes("[ERROR]")) toast.error(message);
      else if (upper.includes("[WARN]") || upper.includes("[WARNING]"))
        toast.message(message);
      else if (upper.includes("[SUCCESS]") || upper.includes("[SUCESS]"))
        toast.success(message, { duration: 20000 });
      else if (upper.includes("[INFO]")) toast.info(message);
      else toast.message(message);
    };

    es.addEventListener("image", (ev: MessageEvent) => {
      const b64 = ev.data as string;
      setImageUrl(`data:image/png;base64,${b64}`);
    });

    es.onerror = () => {
      const msg = "Log stream closed";
      setLogs((l) => [...l, msg]);
      toast.message(msg);
      es.close();
    };
    return () => es.close();
  }, [jobId]);

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
    const nearBottom =
      root.scrollTop + root.clientHeight >= root.scrollHeight - 24;
    if (nearBottom) {
      root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
    }
  }, [logs]);

  const clearLogs = () => setLogs([]);

  return (
    <div className="container mx-auto max-w-7xl p-6 flex min-h-[100dvh]">
      {/* Mobile: stacked; Desktop: 3-col grid */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3">
        {/* --- Mobile Screenshot (top) --- */}
        <Card className="shadow-lg lg:hidden">
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

        {/* --- Left column: Form (mobile below screenshot; desktop left) --- */}
        <Card className="shadow-lg lg:row-span-2">
          <CardHeader>
            <CardTitle>WhatsApp Mass Sender</CardTitle>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={onSubmit} className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="namelist">
                  Excel (.xlsx) with “Mobile Number” column
                  <span className="text-red-500">*</span>
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
                <Label htmlFor="message">
                  Message Template (.txt)
                  <span className="text-red-500">*</span>
                </Label>
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
                  Images (png, jpg, jpeg, gif, bmp, ico, webp)
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
                <Label htmlFor="document">Document</Label>
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
              <ScrollArea
                className="max-h-72 overflow-y-auto rounded-md border h-72"
                ref={logsContainerRef}
              >
                <pre className="p-4 text-sm whitespace-pre-wrap break-words">
                  {logs.length ? logs.join("\n") : "Logs will appear here..."}
                </pre>
              </ScrollArea>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            {jobId ? `Job ID: ${jobId}` : "No active job"}
          </CardFooter>
        </Card>

        {/* --- Right column (desktop only): Instructions + Screenshot stack --- */}
        <div className="hidden lg:flex lg:col-span-2 lg:flex-col lg:gap-6 lg:sticky lg:top-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Upload the Namelist Excel file. (Must contain the column name
                  <code className="px-1">Mobile Number</code>)
                </li>
                <li>
                  Upload the Message Template file. (Use{" "}
                  <code className="px-1">{`{Name}`}</code> to personalize with
                  the <code className="px-1">Name</code> column)
                </li>
                <li>Upload Image file(s) [Optional, &lt; 16 MB each]</li>
                <li>Upload Document file [Optional, &lt; 16 MB]</li>
                <li>Click “Send Message”.</li>
                <li>Use “Reset” to clear selections.</li>
              </ol>
              <div className="mt-5">
                <p className="font-medium">Note</p>
                <p>
                  Custom images require an image path and an{" "}
                  <code className="px-1">ImageURL</code> column in Excel.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
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
    </div>
  );
}
