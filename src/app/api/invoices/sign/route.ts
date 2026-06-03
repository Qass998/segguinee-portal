import { NextResponse } from "next/server";
import { atList, atUpdate } from "@/lib/airtable";
import { sendMessage } from "@/lib/whatsapp";

export async function POST(req: Request) {
  try {
    const { invoiceId, token } = await req.json();

    // Verify the token matches the invoice
    const records = await atList("invoices", {
      filterByFormula: `{Sign_token}='${token}'`,
      maxRecords: 1,
    });

    const record = records[0];
    if (!record || record.id !== invoiceId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    if (record.fields.Signed) {
      return NextResponse.json({ ok: true, already: true });
    }

    const now = new Date().toISOString();

    // Mark as signed
    await atUpdate("invoices", invoiceId, {
      Signed:    true,
      Signed_at: now,
      Status:    "paid",
    });

    // Notify director
    const directorPhone = process.env.SEGGUINEE_DIRECTOR_PHONE || "";
    if (directorPhone) {
      const signedAt = new Date(now).toLocaleString("fr-FR", {
        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      });
      await sendMessage(
        directorPhone,
        `✅ *Facture confirmée*\n\nRéférence: ${record.fields.Reference || invoiceId}\nClient: ${record.fields.Customer_name || record.fields.Customer_phone || "—"}\nMontant: ${(record.fields.Amount_GNF || 0).toLocaleString("fr-FR")} GNF\nSignée le: ${signedAt}\n\n_Agent Facturation SEGGUINÉE_`,
      );
    }

    // Confirm to client
    const clientPhone = record.fields.Customer_phone as string;
    if (clientPhone) {
      await sendMessage(
        clientPhone,
        `✅ *Confirmation reçue*\n\nVotre accord sur la facture ${record.fields.Reference || ""} de ${(record.fields.Amount_GNF || 0).toLocaleString("fr-FR")} GNF a été enregistré.\n\nMerci de votre confiance.\n\n_Service Facturation SEGGUINÉE_`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
