import { NextResponse } from "next/server";
import { initializeWhatsAppClient } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    await initializeWhatsAppClient();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Initialization error:", error);
    return NextResponse.json(
      { error: "Failed to initialize WhatsApp client" },
      { status: 500 }
    );
  }
}
