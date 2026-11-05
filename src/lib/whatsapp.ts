import "server-only";

// WhatsApp Business Cloud API : envoi d'un message texte
const GRAPH = "https://graph.facebook.com/v21.0";

export const whatsappConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export async function sendWhatsApp(to: string, body: string) {
  if (!whatsappConfigured()) return false;
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body: body.slice(0, 4000) } }),
  });
  return res.ok;
}

// Le formatage Markdown léger du site vers celui de WhatsApp
export const toWhatsApp = (text: string) => text.replace(/\*\*([^*]+)\*\*/g, "*$1*").replace(/```\w*\n?/g, "```");
