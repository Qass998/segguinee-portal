import { NextResponse } from 'next/server';
import { atList, atCreate } from '@/lib/airtable';

export async function POST() {
  try {
    const openaiKey = process.env.OPENAI_API_KEY || '';

    // Fetch all operational data in parallel
    const [prodRecords, invoiceRecords, incidentRecords, projectRecords, msgRecords] = await Promise.all([
      atList('production', { sort: [{ field: 'Recorded_at', direction: 'desc' }], maxRecords: 3 }),
      atList('invoices',   { filterByFormula: `OR({Status}='pending',{Status}='overdue')`, maxRecords: 200 }),
      atList('incidents',  { filterByFormula: `OR({Status}='open',{Status}='in_progress')` }),
      atList('projects',   { filterByFormula: `{Statut}='en_cours'` }),
      atList('messages',   { sort: [{ field: 'Created_at', direction: 'desc' }], maxRecords: 50 }),
    ]);

    // Summarise data
    const latestProd    = prodRecords[0]?.fields;
    const pendingTotal  = invoiceRecords.reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
    const activeInc     = incidentRecords.length;
    const activeProj    = projectRecords.length;
    const msgToday      = msgRecords.filter(r => {
      const d = r.fields.Created_at as string;
      return d && d.slice(0, 10) === new Date().toISOString().slice(0, 10);
    }).length;

    let insight = '';

    if (openaiKey) {
      const dataCtx = [
        `Production dernière entrée: ${latestProd ? `${latestProd.Volume_m3} m³ à ${latestProd.Station} (${latestProd.Zone || '—'})` : 'Aucune donnée'}`,
        `Factures en attente/retard: ${invoiceRecords.length} (total: ${pendingTotal.toLocaleString('fr-FR')} GNF)`,
        `Incidents actifs: ${activeInc}${activeInc > 0 ? ' — ' + incidentRecords.slice(0,2).map(r => `${r.fields.Type} à ${r.fields.Zone}`).join(', ') : ''}`,
        `Projets en cours: ${activeProj}${activeProj > 0 ? ' — ' + projectRecords.slice(0,2).map(r => r.fields.Nom).join(', ') : ''}`,
        `Messages WhatsApp aujourd'hui: ${msgToday}`,
      ].join('\n');

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          messages: [
            {
              role: 'system',
              content: `Tu es l'Agent Analyse de SEGGUINÉE, la société des eaux de Guinée.
Analyse les données opérationnelles et génère un briefing structuré.
Format EXACT à respecter (3 lignes courtes, max 200 mots total):
SITUATION: [2 faits chiffrés les plus importants]
PRIORITÉ: [l'action la plus urgente]
RECOMMANDATION: [action précise à prendre aujourd'hui]
Français uniquement. Concis. Pas de bullet points.`,
            },
            { role: 'user', content: `DONNÉES OPÉRATIONNELLES:\n${dataCtx}` },
          ],
        }),
      });
      const data = await resp.json();
      insight = data.choices?.[0]?.message?.content?.trim() || '';
    }

    // Rule-based fallback
    if (!insight) {
      const parts = [];
      parts.push(`SITUATION: ${invoiceRecords.length} facture(s) impayée(s) pour ${pendingTotal.toLocaleString('fr-FR')} GNF. ${activeInc} incident(s) actif(s).`);
      if (activeInc > 0) {
        parts.push(`PRIORITÉ: Résoudre les ${activeInc} incident(s) actif(s) avant impact sur la distribution.`);
        parts.push(`RECOMMANDATION: Assigner les équipes de terrain aux incidents en cours.`);
      } else if (invoiceRecords.length > 5) {
        parts.push(`PRIORITÉ: Recouvrement — ${invoiceRecords.length} factures en attente.`);
        parts.push(`RECOMMANDATION: Lancer les relances WhatsApp depuis l'onglet Conversations.`);
      } else {
        parts.push(`PRIORITÉ: Opérations stables.`);
        parts.push(`RECOMMANDATION: Maintenir la fréquence des relevés de production.`);
      }
      insight = parts.join('\n');
    }

    // Store in Agents_Log
    const now = new Date();
    const record = await atCreate('agents_log', {
      Agent:              'Agent Analyse',
      Agent_id:           'data_analyser',
      Icon:               '📊',
      Statut:             'actif',
      Insight:            insight,
      Derniere_execution: `${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      Heure_execution:    now.toISOString(),
    });

    return NextResponse.json({
      id:              record.id,
      insight,
      heure_execution: now.toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
