import { NextResponse } from 'next/server';
import { atList, atCreate } from '@/lib/airtable';

export async function GET() {
  try {
    const records = await atList('projects', {
      sort: [{ field: 'Created_at', direction: 'desc' }],
      maxRecords: 100,
    });
    return NextResponse.json(records.map(r => ({
      id:           r.id,
      nom:          r.fields.Nom          ?? '',
      type:         r.fields.Type         ?? '',
      zone:         r.fields.Zone         ?? '',
      statut:       r.fields.Statut       ?? 'planifié',
      budget_gnf:   r.fields.Budget_GNF   ?? 0,
      depense_gnf:  r.fields.Depense_GNF  ?? 0,
      date_debut:   r.fields.Date_debut   ?? '',
      date_fin:     r.fields.Date_fin     ?? '',
      chef_projet:  r.fields.Chef_projet  ?? '',
      description:  r.fields.Description  ?? '',
      created_at:   r.fields.Created_at   ?? '',
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const record = await atCreate('projects', {
      Nom:         body.nom          || '',
      Type:        body.type         || 'construction',
      Zone:        body.zone         || '',
      Statut:      body.statut       || 'planifié',
      Budget_GNF:  Number(body.budget_gnf)  || 0,
      Depense_GNF: Number(body.depense_gnf) || 0,
      Date_debut:  body.date_debut   || '',
      Date_fin:    body.date_fin     || '',
      Chef_projet: body.chef_projet  || '',
      Description: body.description  || '',
      Created_at:  new Date().toISOString(),
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
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable delete: ${res.status}`);
    return NextResponse.json({ deleted: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
