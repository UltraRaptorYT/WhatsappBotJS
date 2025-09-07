// app/api/whatsapp/qr/route.ts
export const runtime = "nodejs"; // must be Node, not edge
import { NextResponse } from "next/server";
import { getWhatsAppClient, getLastQr, isReady } from "@/lib/whatsapp";

export async function GET() {
  // Ensure the client is initialized once per server
  getWhatsAppClient();
  // Return current status + the latest QR (if any)
  return NextResponse.json({
    ready: isReady(),
    qrDataUrl: getLastQr(), // may be null if already paired / not generated yet
  });
}
