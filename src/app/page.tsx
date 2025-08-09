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
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setSubmitting(true);
    setLogs((l) => [...l, "Starting job..."]);

    try {
      const fd = new FormData(formRef.current);
      const res = await fetch("/api/send", { method: "POST", body: fd });
      if (!res.ok) {
        setLogs((l) => [...l, "Start failed"]);
        return;
      }
      const { jobId } = await res.json();
      setJobId(jobId);
      setLogs((l) => [...l, `Job started: ${jobId}`]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setLogs((l) => [...l, `Error: ${err?.message || err}`]);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    const es = new EventSource(
      `/api/send/logs?jobId=${encodeURIComponent(jobId)}`
    );
    es.onmessage = (ev) => setLogs((l) => [...l, ev.data]);
    es.onerror = () => {
      setLogs((l) => [...l, "Log stream closed"]);
      es.close();
    };
    return () => es.close();
  }, [jobId]);

  const clearLogs = () => setLogs([]);

  return (
    <div className="container mx-auto max-w-3xl p-6">
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

            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Starting..." : "Send Message"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  formRef.current?.reset();
                }}
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
            <ScrollArea className="h-72 rounded-md border">
              <pre className="p-4 text-sm">
                {logs.length ? logs.join("\n") : "Logs will appear here..."}
              </pre>
            </ScrollArea>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          {jobId ? `Job ID: ${jobId}` : "No active job"}
        </CardFooter>
      </Card>
    </div>
  );
}
