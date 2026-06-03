/**
 * POST /api/reports/monthly
 * Generates a monthly report, stores in Airtable, sends WhatsApp link.
 * Called by cron or manually from dashboard.
 */
import { NextResponse } from 'next/server';
import { atList, atCreate } from '@/lib/airtable';
import { sendMessage } from '@/lib/whatsapp';
import { randomUUID } from 'crypto';

const PORTAL_URL = 'https://segguinee.vercel.app';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const manual = body.manual === true;

    const now   = new Date();
    const month = now.getMonth(); // 0-indexed
    const year  = now.getFullYear();
    // Report covers previous month if called by cron on 1st
    const reportMonth = manual ? month : (month === 0 ? 11 : month - 1);
    const reportYear  = manual ? year  : (month === 0 ? year - 1 : year);

    const monthName = new Date(reportYear, reportMonth, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const period = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    // Date range for the report month
    const startDate = new Date(reportYear, reportMonth, 1).toISOString().slice(0, 10);
    const endDate   = new Date(reportYear, reportMonth + 1, 0).toISOString().slice(0, 10);

    // Fetch all data in parallel
    const [prodRecords, paidInv, unpaidInv, incidentRecords, projectRecords, fieldRecords] = await Promise.all([
      atList('production', { filterByFormula: `AND(IS_AFTER({Recorded_at},'${startDate}'),IS_BEFORE({Recorded_at},'${endDate}T23:59:59'))`, maxRecords: 500 }),
      atList('invoices',   { filterByFormula: `AND({Status}='paid',IS_AFTER({Paid_at},'${startDate}'))`, maxRecords: 500 }),
      atList('invoices',   { filterByFormula: `OR({Status}='pending',{Status}='overdue')`, maxRecords: 500 }),
      atList('incidents',  { maxRecords: 500 }),
      atList('projects',   { filterByFormula: `{Statut}='en_cours'` }),
      atList('field_reports', { filterByFormula: `IS_AFTER({Created_at},'${startDate}')`, maxRecords: 500 }),
    ]);

    // Compute metrics
    const totalProd     = prodRecords.reduce((s, r) => s + (r.fields.Volume_m3 || 0), 0);
    const revenue       = paidInv.reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
    const unpaidTotal   = unpaidInv.reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
    const incTotal      = incidentRecords.length;
    const incResolved   = incidentRecords.filter(r => r.fields.Status === 'resolved' || r.fields.Status === 'closed').length;
    const fieldCount    = fieldRecords.length;

    // Generate AI narrative
    let narrative = '';
    let recommendations = '';
    const openaiKey = process.env.OPENAI_API_KEY || '';

    if (openaiKey) {
      const ctx = [
        `Période: ${period}`,
        `Production eau: ${totalProd.toLocaleString('fr-FR')} m³`,
        `Revenus encaissés: ${revenue.toLocaleString('fr-FR')} GNF (${paidInv.length} factures)`,
        `Impayés: ${unpaidTotal.toLocaleString('fr-FR')} GNF (${unpaidInv.length} factures)`,
        `Incidents: ${incTotal} signalés, ${incResolved} résolus`,
        `Interventions terrain: ${fieldCount}`,
        `Projets en cours: ${projectRecords.length}`,
      ].join('\n');

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: `Tu es l'Agent Analyse de SEGGUINÉE. Génère un rapport mensuel professionnel en français.

Produis EXACTEMENT ce format (pas de markdown sauf les retours à la ligne):

SYNTHÈSE:
[2-3 phrases résumant le mois — ce qui s'est bien passé, ce qui nécessite attention]

RECOMMANDATIONS:
1. [Action précise et exécutable]
2. [Action précise et exécutable]
3. [Action précise et exécutable]

Langue: français professionnel. Basé uniquement sur les données fournies. Ne pas inventer.`,
            },
            { role: 'user', content: ctx },
          ],
        }),
      });
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      const synthIdx = content.indexOf('SYNTHÈSE:');
      const recIdx   = content.indexOf('RECOMMANDATIONS:');
      if (synthIdx !== -1 && recIdx !== -1) {
        narrative       = content.slice(synthIdx + 9, recIdx).trim();
        recommendations = content.slice(recIdx + 16).trim();
      } else {
        narrative = content;
      }
    }

    if (!narrative) {
      narrative = `${period} — Production: ${totalProd.toLocaleString('fr-FR')} m³. Revenus: ${revenue.toLocaleString('fr-FR')} GNF. ${incTotal} incidents signalés, ${incResolved} résolus.`;
      recommendations = `1. Relancer les ${unpaidInv.length} factures impayées.\n2. Finaliser les incidents actifs avant fin de mois.\n3. Maintenir la fréquence des relevés de production.`;
    }

    // Store report
    const reportId = randomUUID().replace(/-/g, '').slice(0, 20);
    await atCreate('monthly_reports', {
      Report_id:         reportId,
      Period:            period,
      Narrative:         narrative,
      Production_m3:     totalProd,
      Invoices_paid:     paidInv.length,
      Invoices_unpaid:   unpaidInv.length,
      Revenue_GNF:       revenue,
      Incidents_total:   incTotal,
      Incidents_resolved: incResolved,
      Recommendations:   recommendations,
      Generated_at:      now.toISOString(),
    });

    const reportUrl = `${PORTAL_URL}/reports/${reportId}`;

    // Send WhatsApp to director
    const directorPhone = process.env.SEGGUINEE_DIRECTOR_PHONE || '';
    if (directorPhone) {
      await sendMessage(directorPhone,
        `📊 *Rapport ${period} — SEGGUINÉE*\n\nVotre rapport mensuel est prêt.\n\n• Production: ${totalProd.toLocaleString('fr-FR')} m³\n• Revenus: ${revenue.toLocaleString('fr-FR')} GNF\n• Incidents résolus: ${incResolved}/${incTotal}\n\nConsultez le rapport complet ici:\n${reportUrl}\n\n_Agent Analyse SEGGUINÉE_`
      );
    }

    return NextResponse.json({ ok: true, reportId, reportUrl, period });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
