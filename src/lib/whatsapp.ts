/**
 * lib/whatsapp.ts — Meta WhatsApp Cloud API
 *
 * Sends messages via Meta's WhatsApp Business API (v22.0).
 * One phone number handles: daily briefing, billing reminders, customer replies.
 */

const META_API = "https://graph.facebook.com/v22.0";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a WhatsApp text message via Meta Cloud API.
 */
export async function sendMessage(to: string, body: string): Promise<SendResult> {
  if (!PHONE_ID || !TOKEN) {
    return { ok: false, error: "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not set" };
  }

  const url = `${META_API}/${PHONE_ID}/messages`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
    });

    const data = await resp.json();

    if (resp.ok && data.messages) {
      return { ok: true, messageId: data.messages[0].id };
    }

    return { ok: false, error: data.error?.message || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/**
 * Verify the director's phone number against env var.
 */
export function isDirector(phone: string): boolean {
  const directorPhone = process.env.SEGGUINEE_DIRECTOR_PHONE || "";
  return phone.replace(/^whatsapp:/, "").trim() === directorPhone.replace(/^whatsapp:/, "").trim();
}
