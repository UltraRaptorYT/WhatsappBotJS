import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode";
import chromium from "@sparticuz/chromium";

let clientInstance: Client | null = null;
let qrCodeData: string | null = null;
let isClientReady = false;
let initializationPromise: Promise<void> | null = null;

async function getPuppeteerConfig() {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    const { default: puppeteer } = await import("puppeteer");
    return {
      headless: true,
      args: ["--no-sandbox"],
      executablePath: puppeteer.executablePath(),
    };
  }

  // Production with @sparticuz/chromium
  return {
    headless: true,
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    executablePath: await chromium.executablePath(),
  };
}

export async function initializeWhatsAppClient(): Promise<void> {
  // Return existing initialization if in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return immediately if already initialized
  if (clientInstance && isClientReady) {
    return Promise.resolve();
  }

  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      const puppeteerConfig = await getPuppeteerConfig();

      clientInstance = new Client({
        authStrategy: new LocalAuth({
          dataPath: "/tmp/whatsapp-sessions", // Use /tmp for Vercel
        }),
        puppeteer: puppeteerConfig,
      });

      clientInstance.on("qr", async (qr) => {
        console.log("QR Code received");
        qrCodeData = await qrcode.toDataURL(qr);
      });

      clientInstance.on("ready", () => {
        console.log("WhatsApp Client is ready!");
        isClientReady = true;
        qrCodeData = null;
        resolve();
      });

      clientInstance.on("authenticated", () => {
        console.log("WhatsApp authenticated!");
      });

      clientInstance.on("auth_failure", () => {
        console.error("Authentication failed");
        isClientReady = false;
        reject(new Error("Authentication failed"));
      });

      clientInstance.on("disconnected", () => {
        console.log("Client disconnected");
        isClientReady = false;
        clientInstance = null;
        initializationPromise = null;
      });

      await clientInstance.initialize();
    } catch (error) {
      console.error("Failed to initialize WhatsApp client:", error);
      initializationPromise = null;
      reject(error);
    }
  });

  return initializationPromise;
}

export function getClientStatus() {
  return {
    isReady: isClientReady,
    qrCode: qrCodeData,
    isInitializing: initializationPromise !== null,
  };
}

export async function sendMessage(number: string, message: string) {
  if (!clientInstance || !isClientReady) {
    throw new Error("WhatsApp client not ready");
  }

  // Format number: remove non-digits and ensure proper format
  const formattedNumber = number.replace(/\D/g, "");
  const chatId = formattedNumber.includes("@c.us")
    ? formattedNumber
    : `${formattedNumber}@c.us`;

  return await clientInstance.sendMessage(chatId, message);
}

export async function disconnectClient() {
  if (clientInstance) {
    await clientInstance.destroy();
    clientInstance = null;
    isClientReady = false;
    qrCodeData = null;
    initializationPromise = null;
  }
}
