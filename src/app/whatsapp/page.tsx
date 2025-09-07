import WhatsAppClient from "@/components/WhatsApp-Client";

export default function WhatsAppPage() {
  return (
    <main className="min-h-screen bg-gray-100 py-12">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          WhatsApp Messenger
        </h1>
        <WhatsAppClient />
      </div>
    </main>
  );
}
