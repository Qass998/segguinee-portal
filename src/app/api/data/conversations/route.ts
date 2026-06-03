import { NextResponse } from 'next/server';
import { atList, atUpdate } from '@/lib/airtable';

export async function GET() {
  try {
    const records = await atList('conversations', {
      sort: [{ field: 'Last_message_at', direction: 'desc' }],
      maxRecords: 100,
    });
    return NextResponse.json(records.map(r => ({
      id:              r.id,
      phone:           r.fields.Phone           ?? '',
      profile_name:    r.fields.Profile_name    ?? '',
      last_message:    r.fields.Last_message     ?? '',
      last_message_at: r.fields.Last_message_at  ?? '',
      unread_count:    r.fields.Unread_count     ?? 0,
      status:          r.fields.Status           ?? 'active',
      is_director:     r.fields.Is_director      ?? false,
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...fields } = await req.json();
    await atUpdate('conversations', id, fields);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
