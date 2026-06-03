import { NextResponse } from 'next/server';
import { atList, atCreate } from '@/lib/airtable';

export async function GET(req: Request) {
  const today = new URL(req.url).searchParams.get('today');
  try {
    const formula = today === 'true'
      ? `IS_AFTER({Created_at},'${new Date().toISOString().slice(0, 10)}')`
      : undefined;
    const records = await atList('field_reports', {
      filterByFormula: formula,
      sort: [{ field: 'Created_at', direction: 'desc' }],
      maxRecords: 200,
    });
    return NextResponse.json(records.map(r => ({
      id:               r.id,
      reference:        r.fields.Reference        ?? '',
      technician_phone: r.fields.Technician_phone  ?? '',
      technician_name:  r.fields.Technician_name   ?? '',
      action:           r.fields.Action             ?? '',
      location:         r.fields.Location           ?? '',
      description:      r.fields.Description        ?? '',
      created_at:       r.fields.Created_at         ?? '',
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const record = await atCreate('field_reports', {
      Reference:        `FR-${Date.now()}`,
      Technician_phone: body.technician_phone ?? '',
      Technician_name:  body.technician_name  ?? '',
      Action:           body.action            ?? 'rapport',
      Location:         body.location          ?? '',
      Description:      body.description       ?? '',
      Created_at:       new Date().toISOString(),
    });
    return NextResponse.json({ id: record.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
