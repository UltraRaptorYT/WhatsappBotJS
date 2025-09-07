import { NextResponse } from "next/server";
import {
  getClientStatus,
  initializeWhatsAppClient,
} from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // For Vercel Pro plan

export async function GET() {
  try {
    const status = getClientStatus();

    // Start initialization if not already started
    if (!status.isReady && !status.isInitializing) {
      initializeWhatsAppClient().catch(console.error);
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
