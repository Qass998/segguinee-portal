/**
 * /api/cron/field-summary — runs daily at 17:00 Guinea time (UTC)
 * Compiles all field reports from today and sends summary to director.
 */
import { NextRequest, NextResponse } from 'next/server';
import { atList } from '@/lib/airtable';
import { sendMessage } from '@/lib/whatsapp';

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const directorPhone = process.env.SEGGUINEE_DIRECTOR_PHONE || '';
  if (!directorPhone) return NextResponse.json({ error: 'No director phone' }, { status: 500 });

  const today = new Date().toISOString().slice(0, 10);
  const records = await atList('field_reports', {
    filterByFormula: `IS_AFTER({Created_at},'${today}')`,
    sort: [{ field: 'Created_at', direction: 'asc' }],
    maxRecords: 200,
  });

  const todayDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (records.length === 0) {
    await sendMessage(directorPhone,
      `📋 *Résumé terrain — ${todayDate}*\n\nAucun rapport terrain reçu aujourd'hui.\n\n_Agent Terrain SEGGUINÉE_`
    );
    return NextResponse.json({ ok: true, count: 0 });
  }

  // Group by action type
  const arrivals  = records.filter(r => r.fields.Action === 'arrivée');
  const rapports  = records.filter(r => r.fields.Action === 'rapport');
  const departures= records.filter(r => r.fields.Action === 'départ');
  const incidents = records.filter(r => r.fields.Action === 'incident');

  // Unique technicians
  const techs = [...new Set(records.map(r => r.fields.Technician_name || r.fields.Technician_phone).filter(Boolean))];
  // Unique zones
  const zones = [...new Set(records.map(r => r.fields.Location).filter(Boolean))];

  const lines = [
    `📋 *Résumé terrain — ${todayDate}*`,
    '',
    `👷 Agents actifs: ${techs.length || '?'} (${zones.slice(0,4).join(', ')})`,
    `📍 Arrivées: ${arrivals.length}`,
    `✅ Rapports: ${rapports.length}`,
    `🏁 Départs: ${departures.length}`,
    incidents.length > 0 ? `🚨 Incidents terrain: ${incidents.length}` : '',
    '',
  ];

  // Add last 3 rapport descriptions
  const lastRapports = rapports.slice(-3);
  if (lastRapports.length > 0) {
    lines.push('*Derniers rapports:*');
    lastRapports.forEach(r => {
      const time = r.fields.Created_at
        ? new Date(r.fields.Created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
      lines.push(`• ${time} — ${r.fields.Location || '?'}: ${(r.fields.Description || '').slice(0, 60)}`);
    });
    lines.push('');
  }

  lines.push('_Agent Terrain SEGGUINÉE_');

  await sendMessage(directorPhone, lines.filter(Boolean).join('\n'));
  return NextResponse.json({ ok: true, count: records.length });
}
