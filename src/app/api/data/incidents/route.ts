import { NextResponse } from 'next/server';
import { atList, atCreate } from '@/lib/airtable';

export async function GET() {
  try {
    const records = await atList('incidents', {
      sort: [{ field: 'Created_at', direction: 'desc' }],
      maxRecords: 50,
    });
    return NextResponse.json(records.map(r => ({
      id:          r.id,
      type:        r.fields.Type        ?? '',
      description: r.fields.Description ?? '',
      zone:        r.fields.Zone        ?? '',
      station:     r.fields.Station     ?? '',
      status:      r.fields.Status      ?? 'open',
      reported_by: r.fields.Reported_by ?? '',
      created_at:  r.fields.Created_at  ?? '',
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const record = await atCreate('incidents', {
      Reference:   `INC-${Date.now()}`,
      Type:        body.type        || 'autre',
      Description: body.description || '',
      Zone:        body.zone        || '',
      Station:     body.station     || '',
      Status:      'open',
      Reported_by: body.reported_by || '',
      Created_at:  new Date().toISOString(),
    });
    return NextResponse.json({ id: record.id, ...record.fields });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
