import { NextResponse } from 'next/server';
import { atList, atCreate } from '@/lib/airtable';

export async function GET() {
  try {
    const records = await atList('production', {
      sort: [{ field: 'Recorded_at', direction: 'desc' }],
      maxRecords: 50,
    });
    return NextResponse.json(records.map(r => ({
      id:          r.id,
      volume_m3:   r.fields.Volume_m3   ?? 0,
      station:     r.fields.Station     ?? '',
      zone:        r.fields.Zone        ?? '',
      recorded_by: r.fields.Recorded_by ?? '',
      recorded_at: r.fields.Recorded_at ?? '',
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const record = await atCreate('production', {
      Reference:   `PROD-${Date.now()}`,
      Volume_m3:   Number(body.volume_m3)   || 0,
      Station:     body.station             || '',
      Zone:        body.zone                || '',
      Recorded_by: body.recorded_by         || '',
      Recorded_at: new Date().toISOString(),
    });
    return NextResponse.json({ id: record.id, ...record.fields });
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
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/production/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable delete: ${res.status}`);
    return NextResponse.json({ deleted: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
