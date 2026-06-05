import { NextResponse } from 'next/server';
import { atList, atCreate } from '@/lib/airtable';
import { sendMessage } from '@/lib/whatsapp';
import { randomUUID } from 'crypto';

const PORTAL_URL = 'https://segguinee.vercel.app';

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get('status');
  try {
    const formula = status && status !== 'all' ? `{Status}='${status}'` : undefined;
    const records = await atList('invoices', {
      filterByFormula: formula,
      sort: [{ field: 'Created_at', direction: 'desc' }],
      maxRecords: 100,
    });
    return NextResponse.json(records.map(r => ({
      id:             r.id,
      customer_phone: r.fields.Customer_phone ?? '',
      customer_name:  r.fields.Customer_name  ?? '',
      amount_gnf:     r.fields.Amount_GNF     ?? 0,
      reference:      r.fields.Reference      ?? '',
      description:    r.fields.Description    ?? '',
      due_date:       r.fields.Due_date        ?? '',
      status:         r.fields.Status          ?? 'pending',
      signed:         r.fields.Signed          ?? false,
      paid_at:        r.fields.Paid_at         ?? null,
      created_at:     r.fields.Created_at      ?? '',
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = randomUUID().replace(/-/g, '').slice(0, 24);
    const reference = `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const record = await atCreate('invoices', {
      Reference:      reference,
      Customer_phone: body.customer_phone  || '',
      Customer_name:  body.customer_name   || '',
      Amount_GNF:     Number(body.amount_gnf) || 0,
      Description:    body.description     || '',
      Due_date:       body.due_date        || '',
      Status:         'pending',
      Sign_token:     token,
      Created_at:     new Date().toISOString(),
    });

    // Send WhatsApp to client if phone provided
    const clientPhone = body.customer_phone as string;
    if (clientPhone && clientPhone.length > 6) {
      const signingLink = `${PORTAL_URL}/sign/${token}`;
      const amount = (Number(body.amount_gnf) || 0).toLocaleString('fr-FR');
      const dueDate = body.due_date
        ? new Date(body.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      const msg = [
        `Bonjour${body.customer_name ? ' ' + body.customer_name : ''},`,
        '',
        `La *SEGGUINÉE* vous adresse une facture de *${amount} GNF*.`,
        '',
        `📄 Référence: ${reference}`,
        body.description ? `📝 Objet: ${body.description}` : '',
        dueDate ? `📅 Échéance: ${dueDate}` : '',
        '',
        `Consultez et confirmez votre facture ici:`,
        signingLink,
        '',
        `_Pour toute question, répondez à ce message._`,
        `_Service Facturation SEGGUINÉE_`,
      ].filter(Boolean).join('\n');

      await sendMessage(clientPhone, msg).catch(() => null); // non-blocking
    }

    return NextResponse.json({ id: record.id, token, reference });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 });
    const BASE_ID = process.env.SEGGUINEE_AIRTABLE_BASE ?? '';
    const TOKEN   = process.env.AIRTABLE_TOKEN ?? '';
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/invoices/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable delete: ${res.status}`);
    return NextResponse.json({ deleted: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
