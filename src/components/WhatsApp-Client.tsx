"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Status {
  isReady: boolean;
  qrCode: string | null;
  isInitializing: boolean;
}

export default function WhatsAppClient() {
  const [status, setStatus] = useState<Status>({
    isReady: false,
    qrCode: null,
    isInitializing: false,
  });
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Poll for status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch("/api/whatsapp/status");
        const data = await response.json();
        setStatus(data);
      } catch (error) {
        console.error("Failed to check status:", error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleInitialize = async () => {
    try {
      setResult(null);
      const response = await fetch("/api/whatsapp/initialize", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to initialize");
      }

      setResult({
        type: "success",
        message: "Initializing WhatsApp... Please wait for QR code.",
      });
    } catch (error) {
      setResult({
        type: "error",
        message: "Failed to initialize WhatsApp client",
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setResult({ type: "success", message: "Message sent successfully!" });
      setMessage("");
    } catch (error) {
      setResult({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to send message",
      });
    } finally {
      setSending(false);
    }
  };

  // Show QR Code
  if (status.qrCode) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Scan QR Code with WhatsApp</h2>
        <div className="border-2 border-gray-300 p-4 rounded-lg bg-gray-50">
          <Image
            src={status.qrCode}
            alt="WhatsApp QR Code"
            width={300}
            height={300}
            className="mx-auto"
          />
        </div>
        <p className="text-sm text-gray-600 mt-4 text-center">
          Open WhatsApp on your phone → Settings → Linked Devices → Link a
          Device
        </p>
      </div>
    );
  }

  // Show initialization button
  if (!status.isReady && !status.isInitializing) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">WhatsApp Web Integration</h2>
        <p className="text-gray-600 mb-6">
          Click the button below to initialize WhatsApp Web connection.
        </p>
        <button
          onClick={handleInitialize}
          className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          Initialize WhatsApp
        </button>
        {result && (
          <div
            className={`mt-4 p-3 rounded-lg ${
              result.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
    );
  }

  // Show loading
  if (status.isInitializing) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4">Initializing...</h2>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
        <p className="text-center mt-4 text-gray-600">
          Please wait while WhatsApp Web initializes...
        </p>
      </div>
    );
  }

  // Show message form
  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-green-600">
        ✓ WhatsApp Connected
      </h2>

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="60123456789"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Include country code without + (e.g., 60 for Malaysia)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent h-32 resize-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {sending ? "Sending..." : "Send Message"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 p-3 rounded-lg ${
            result.type === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
