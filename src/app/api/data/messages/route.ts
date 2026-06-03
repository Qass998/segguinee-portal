import { NextResponse } from 'next/server';
import { atList } from '@/lib/airtable';

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get('phone');
  if (!phone) return NextResponse.json([]);
  try {
    const records = await atList('messages', {
      filterByFormula: `{Conversation_phone}='${phone}'`,
      sort: [{ field: 'Created_at', direction: 'asc' }],
      maxRecords: 200,
    });
    return NextResponse.json(records.map(r => ({
      id:                 r.id,
      conversation_phone: r.fields.Conversation_phone ?? '',
      direction:          r.fields.Direction          ?? 'inbound',
      body:               r.fields.Body               ?? '',
      action:             r.fields.Action             ?? '',
      ai_generated:       r.fields.AI_generated       ?? false,
      created_at:         r.fields.Created_at         ?? '',
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
