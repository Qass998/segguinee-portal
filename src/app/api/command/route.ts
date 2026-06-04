import { NextResponse } from 'next/server';
import { atCreate, atUpdate, atList } from '@/lib/airtable';
import { sendMessage } from '@/lib/whatsapp';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DIRECTOR_PHONE = process.env.SEGGUINEE_DIRECTOR_PHONE || '';

export async function GET() {
  try {
    const records = await atList('tasks', {
      sort: [{ field: 'Created_at', direction: 'desc' }],
      maxRecords: 20,
    });
    return NextResponse.json(records.map(r => ({
      id:           r.id,
      command:      r.fields.Command      ?? '',
      status:       r.fields.Status       ?? 'pending',
      result:       r.fields.Result       ?? '',
      action_taken: r.fields.Action_taken ?? '',
      created_at:   r.fields.Created_at   ?? '',
      executed_at:  r.fields.Executed_at  ?? '',
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { command } = await req.json();
  if (!command?.trim()) return NextResponse.json({ error: 'No command' }, { status: 400 });

  const record = await atCreate('tasks', {
    Command:    command,
    Status:     'pending',
    Created_at: new Date().toISOString(),
  });
  const taskId = record.id;

  try {
    await atUpdate('tasks', taskId, { Status: 'executing' });

    const [invoices, incidents, production, projects, staff] = await Promise.all([
      atList('invoices', { maxRecords: 20, sort: [{ field: 'Created_at', direction: 'desc' }] }),
      atList('incidents', { maxRecords: 10, sort: [{ field: 'Created_at', direction: 'desc' }] }),
      atList('production', { maxRecords: 10, sort: [{ field: 'Recorded_at', direction: 'desc' }] }),
      atList('projects', { maxRecords: 10 }),
      atList('staff', { maxRecords: 20 }),
    ]);

    const overdueInvoices = invoices.filter(r => r.fields.Status === 'overdue');
    const pendingInvoices = invoices.filter(r => r.fields.Status === 'pending');
    const openIncidents   = incidents.filter(r => r.fields.Status === 'open' || r.fields.Status === 'in_progress');
    const activeProjects  = projects.filter(r => r.fields.Statut === 'en_cours');
    const totalProduction = production.reduce((s, r) => s + (r.fields.Volume_m3 || 0), 0);
    const collectedGNF    = invoices.filter(r => r.fields.Status === 'paid').reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
    const pendingGNF      = pendingInvoices.reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
    const overdueGNF      = overdueInvoices.reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);

    const context = `
Données SEGGUINÉE en temps réel:
- Production totale: ${totalProduction.toLocaleString('fr-FR')} m³ (${production.length} relevés)
- Dernier relevé: ${production[0]?.fields.Volume_m3 ?? '?'} m³ à ${production[0]?.fields.Station ?? '?'} (${production[0]?.fields.Zone ?? '?'})
- Collecté: ${collectedGNF.toLocaleString('fr-FR')} GNF
- En attente: ${pendingGNF.toLocaleString('fr-FR')} GNF (${pendingInvoices.length} factures)
- En retard: ${overdueGNF.toLocaleString('fr-FR')} GNF (${overdueInvoices.length} clients)
- Clients en retard: ${overdueInvoices.slice(0,5).map(r => `${r.fields.Customer_name} (${(r.fields.Amount_GNF||0).toLocaleString('fr-FR')} GNF, tél: ${r.fields.Customer_phone||'?'})`).join('; ')}
- Incidents ouverts: ${openIncidents.length} — ${openIncidents.slice(0,3).map(r => `${r.fields.Type} à ${r.fields.Zone}/${r.fields.Station}`).join(', ') || 'aucun'}
- Projets actifs: ${activeProjects.length} — ${activeProjects.map(r => `${r.fields.Nom} (${r.fields.Zone})`).join(', ') || 'aucun'}
- Équipes terrain: ${staff.slice(0,5).map(r => `${r.fields.Name||''} (${r.fields.Role||''}, tél: ${r.fields.Phone||'?'})`).join('; ')}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es l'IA opérationnelle de SEGGUINÉE (société des eaux de Guinée). Tu exécutes les instructions du directeur.

Actions disponibles:
- CREATE_INVOICE: créer une facture (params: customer_name, customer_phone, amount_gnf, description, due_date)
- SEND_WHATSAPP: envoyer WhatsApp (params: phone, message)
- SEND_REMINDER: rappels de paiement aux clients en retard (pas de params — utilise les données contexte)
- LOG_INCIDENT: signaler incident (params: type, description, zone, station, reported_by)
- RESOLVE_INCIDENT: résoudre un incident (params: zone, station — cherche dans contexte)
- ADD_PRODUCTION: relevé de production (params: volume_m3, station, zone, recorded_by)
- DISPATCH_TEAM: déployer équipe terrain (params: zone, mission, team_phone — cherche dans contexte staff)
- SUMMARIZE: résumé complet de la situation actuelle
- DAILY_BRIEFING: briefing détaillé pour le directeur (KPIs + priorités + recommandations)
- BOARD_REPORT: préparer résumé rapport conseil d'administration
- SEND_INVOICE_LINK: envoyer lien de signature à un client (params: customer_name_or_phone)
- UNKNOWN: non reconnu

Réponds UNIQUEMENT en JSON valide:
{
  "action": "ACTION_NAME",
  "params": {},
  "agent": "Nom du responsable qui exécute (ex: Chef de Cabinet, Coordinateur Opérationnel...)",
  "explanation": "Ce que tu fais en 1 phrase",
  "message_to_director": "Confirmation concise pour le directeur"
}`,
        },
        { role: 'user', content: `Contexte:\n${context}\n\nInstruction: "${command}"` },
      ],
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { action: 'UNKNOWN', explanation: raw, message_to_director: raw, agent: 'Système' }; }

    const { action, params, agent, message_to_director } = parsed;
    let result = message_to_director || parsed.explanation || 'Commande traitée';
    const agentLabel = agent || 'Système';

    // ── EXECUTE ────────────────────────────────────────────────────────────

    if (action === 'CREATE_INVOICE') {
      const ref = `INV-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      await atCreate('invoices', {
        Reference:      ref,
        Customer_name:  params.customer_name  || '',
        Customer_phone: params.customer_phone || '',
        Amount_GNF:     Number(params.amount_gnf) || 0,
        Description:    params.description    || '',
        Due_date:       params.due_date        || '',
        Status:         'pending',
        Created_at:     new Date().toISOString(),
      });
      result = `✓ [${agentLabel}] Facture ${ref} créée — ${Number(params.amount_gnf).toLocaleString('fr-FR')} GNF pour ${params.customer_name}`;
      if (params.customer_phone) {
        await sendMessage(params.customer_phone, `Bonjour ${params.customer_name}, votre facture SEGGUINÉE de ${Number(params.amount_gnf).toLocaleString('fr-FR')} GNF a été émise. Référence: ${ref}. Merci.`).catch(() => null);
      }
    }

    else if (action === 'SEND_REMINDER') {
      const targets = [...overdueInvoices, ...pendingInvoices].filter(r => r.fields.Customer_phone);
      let sent = 0;
      for (const inv of targets) {
        const isOverdue = inv.fields.Status === 'overdue';
        const msg = `Bonjour ${inv.fields.Customer_name || ''},\n\n${isOverdue ? '⚠️ Rappel urgent' : 'Rappel'} — Facture SEGGUINÉE en attente.\nMontant: ${(inv.fields.Amount_GNF || 0).toLocaleString('fr-FR')} GNF\nRéférence: ${inv.fields.Reference || ''}\n\nMerci de régulariser votre situation. Pour toute question, contactez-nous.`;
        await sendMessage(inv.fields.Customer_phone, msg).catch(() => null);
        sent++;
      }
      result = `✓ [${agentLabel}] ${sent} rappel${sent > 1 ? 's' : ''} WhatsApp envoyé${sent > 1 ? 's' : ''} — ${overdueInvoices.length} en retard, ${pendingInvoices.length} en attente`;
    }

    else if (action === 'LOG_INCIDENT') {
      const ref = `INC-${Date.now()}`;
      await atCreate('incidents', {
        Reference:   ref,
        Type:        params.type        || 'autre',
        Description: params.description || command,
        Zone:        params.zone        || '',
        Station:     params.station     || '',
        Status:      'open',
        Reported_by: params.reported_by || 'Directeur',
        Created_at:  new Date().toISOString(),
      });
      result = `✓ [${agentLabel}] Incident ${ref} ouvert — ${params.type || 'incident'} à ${params.zone || '?'}/${params.station || '?'}`;
    }

    else if (action === 'RESOLVE_INCIDENT') {
      const match = openIncidents.find(r =>
        (params.zone && r.fields.Zone?.toLowerCase().includes(params.zone.toLowerCase())) ||
        (params.station && r.fields.Station?.toLowerCase().includes(params.station.toLowerCase()))
      ) || openIncidents[0];
      if (match) {
        await atUpdate('incidents', match.id, { Status: 'resolved', Resolved_at: new Date().toISOString() });
        result = `✓ [${agentLabel}] Incident résolu — ${match.fields.Type} à ${match.fields.Zone}/${match.fields.Station}`;
      } else {
        result = `[${agentLabel}] Aucun incident ouvert trouvé pour cette zone`;
      }
    }

    else if (action === 'ADD_PRODUCTION') {
      await atCreate('production', {
        Volume_m3:   Number(params.volume_m3) || 0,
        Station:     params.station     || '',
        Zone:        params.zone        || '',
        Recorded_by: params.recorded_by || 'Directeur',
        Recorded_at: new Date().toISOString(),
      });
      result = `✓ [${agentLabel}] Relevé enregistré — ${params.volume_m3} m³ à ${params.station} (${params.zone})`;
    }

    else if (action === 'DISPATCH_TEAM') {
      const teamPhone = params.team_phone || staff[0]?.fields.Phone;
      const mission = params.mission || command;
      const zone = params.zone || '';
      if (teamPhone) {
        await sendMessage(teamPhone, `📋 *Ordre de mission SEGGUINÉE*\n\nZone: ${zone}\nMission: ${mission}\n\nConfirmez réception par retour de message.\n_${new Date().toLocaleString('fr-FR')}_`);
      }
      await atCreate('incidents', {
        Reference:   `MISSION-${Date.now()}`,
        Type:        'mission_terrain',
        Description: mission,
        Zone:        zone,
        Status:      'in_progress',
        Reported_by: 'Directeur',
        Created_at:  new Date().toISOString(),
      });
      result = `✓ [${agentLabel}] Ordre de mission envoyé${teamPhone ? ` à ${teamPhone}` : ''} — ${zone}: ${mission}`;
    }

    else if (action === 'SEND_INVOICE_LINK') {
      const target = invoices.find(r =>
        r.fields.Customer_name?.toLowerCase().includes((params.customer_name_or_phone || '').toLowerCase()) ||
        r.fields.Customer_phone?.includes(params.customer_name_or_phone || '')
      );
      if (target && target.fields.Sign_token) {
        const link = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://segguinee-portal.vercel.app'}/sign/${target.fields.Sign_token}`;
        await sendMessage(target.fields.Customer_phone, `Bonjour ${target.fields.Customer_name},\n\nVoici votre facture SEGGUINÉE à signer:\n${link}\n\nMontant: ${(target.fields.Amount_GNF||0).toLocaleString('fr-FR')} GNF`).catch(() => null);
        result = `✓ [${agentLabel}] Lien de signature envoyé à ${target.fields.Customer_name} (${target.fields.Customer_phone})`;
      } else {
        result = `[${agentLabel}] Client introuvable ou facture sans token de signature`;
      }
    }

    else if (action === 'SUMMARIZE') {
      result = `[${agentLabel}] Situation SEGGUINÉE — Production: ${totalProduction.toLocaleString('fr-FR')} m³ | Collecté: ${collectedGNF.toLocaleString('fr-FR')} GNF | En attente: ${pendingGNF.toLocaleString('fr-FR')} GNF | En retard: ${overdueGNF.toLocaleString('fr-FR')} GNF (${overdueInvoices.length} clients) | Incidents ouverts: ${openIncidents.length} | Projets actifs: ${activeProjects.length}`;
    }

    else if (action === 'DAILY_BRIEFING') {
      const briefing = [
        `📊 *Briefing SEGGUINÉE — ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}*`,
        '',
        `*SITUATION:* Production ${totalProduction.toLocaleString('fr-FR')} m³. ${collectedGNF.toLocaleString('fr-FR')} GNF collectés. ${overdueInvoices.length} clients en retard (${overdueGNF.toLocaleString('fr-FR')} GNF). ${openIncidents.length} incident${openIncidents.length > 1 ? 's' : ''} ouvert${openIncidents.length > 1 ? 's' : ''}.`,
        '',
        `*PRIORITÉ:* ${overdueInvoices.length > 0 ? `Recouvrement urgent — ${overdueInvoices[0]?.fields.Customer_name} (${(overdueInvoices[0]?.fields.Amount_GNF||0).toLocaleString('fr-FR')} GNF)` : openIncidents.length > 0 ? `Incident ouvert — ${openIncidents[0]?.fields.Type} à ${openIncidents[0]?.fields.Zone}` : 'Aucune urgence — opérations normales'}`,
        '',
        `*RECOMMANDATION:* ${overdueInvoices.length > 0 ? `Envoyer rappels de paiement aux ${overdueInvoices.length} clients en retard` : `Surveiller la production — objectif journalier`}`,
        '',
        `_Répondez GO pour approuver les actions en attente_`,
      ].join('\n');

      if (DIRECTOR_PHONE) await sendMessage(DIRECTOR_PHONE, briefing).catch(() => null);
      result = `✓ [${agentLabel}] Briefing complet envoyé sur WhatsApp`;
    }

    else if (action === 'BOARD_REPORT') {
      const totalBudget = projects.reduce((s, r) => s + (r.fields.Budget_GNF || 0), 0);
      const totalSpent  = projects.reduce((s, r) => s + (r.fields.Depense_GNF || 0), 0);
      const report = [
        `📑 *Rapport Conseil d'Administration — SEGGUINÉE*`,
        `_${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}_`,
        '',
        `*PERFORMANCE FINANCIÈRE*`,
        `• Collecté: ${collectedGNF.toLocaleString('fr-FR')} GNF`,
        `• En attente: ${pendingGNF.toLocaleString('fr-FR')} GNF (${pendingInvoices.length} factures)`,
        `• Créances en retard: ${overdueGNF.toLocaleString('fr-FR')} GNF`,
        '',
        `*PRODUCTION*`,
        `• Volume total: ${totalProduction.toLocaleString('fr-FR')} m³`,
        `• Dernière station: ${production[0]?.fields.Station || '—'} (${production[0]?.fields.Zone || '—'})`,
        '',
        `*PROJETS (${activeProjects.length} actifs)*`,
        `• Budget total: ${totalBudget.toLocaleString('fr-FR')} GNF`,
        `• Dépensé: ${totalSpent.toLocaleString('fr-FR')} GNF (${totalBudget > 0 ? Math.round((totalSpent/totalBudget)*100) : 0}%)`,
        activeProjects.map(r => `• ${r.fields.Nom} — ${r.fields.Zone}`).join('\n'),
        '',
        `*INCIDENTS*`,
        `• Ouverts: ${openIncidents.length}`,
        openIncidents.slice(0,3).map(r => `• ${r.fields.Type} — ${r.fields.Zone}/${r.fields.Station}`).join('\n'),
      ].filter(Boolean).join('\n');

      if (DIRECTOR_PHONE) await sendMessage(DIRECTOR_PHONE, report).catch(() => null);
      result = `✓ [${agentLabel}] Rapport conseil d'administration préparé et envoyé sur WhatsApp`;
    }

    else if (action === 'SEND_WHATSAPP') {
      await sendMessage(params.phone || DIRECTOR_PHONE, params.message || command);
      result = `✓ [${agentLabel}] Message envoyé à ${params.phone || DIRECTOR_PHONE}`;
    }

    else {
      result = `[Système] Commande non reconnue. Essayez: "résume la situation", "envoie les rappels", "déploie l'équipe à [zone]", "briefing du jour"`;
    }

    await atUpdate('tasks', taskId, {
      Status:       'done',
      Result:       result,
      Action_taken: action,
      Executed_at:  new Date().toISOString(),
    });

    return NextResponse.json({ id: taskId, status: 'done', result, action, agent: agentLabel });

  } catch (e: any) {
    await atUpdate('tasks', taskId, { Status: 'failed', Result: e.message }).catch(() => null);
    return NextResponse.json({ id: taskId, status: 'failed', result: e.message }, { status: 500 });
  }
}
