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

  // Log task immediately as pending
  const record = await atCreate('tasks', {
    Command:    command,
    Status:     'pending',
    Created_at: new Date().toISOString(),
  });
  const taskId = record.id;

  try {
    // Update to executing
    await atUpdate('tasks', taskId, { Status: 'executing' });

    // Load context for AI
    const [invoices, incidents, production, projects] = await Promise.all([
      atList('invoices', { maxRecords: 10, sort: [{ field: 'Created_at', direction: 'desc' }] }),
      atList('incidents', { filterByFormula: "{Status}='open'", maxRecords: 5 }),
      atList('production', { maxRecords: 5, sort: [{ field: 'Recorded_at', direction: 'desc' }] }),
      atList('projects', { filterByFormula: "{Statut}='en_cours'", maxRecords: 5 }),
    ]);

    const context = `
Données actuelles SEGGUINÉE:
- Factures récentes: ${invoices.slice(0,5).map(r => `${r.fields.Customer_name} (${r.fields.Amount_GNF} GNF, ${r.fields.Status})`).join(', ')}
- Incidents ouverts: ${incidents.map(r => `${r.fields.Type} à ${r.fields.Zone}`).join(', ') || 'aucun'}
- Dernière production: ${production[0]?.fields.Volume_m3 ?? '?'} m³ à ${production[0]?.fields.Station ?? '?'}
- Projets actifs: ${projects.map(r => r.fields.Nom).join(', ') || 'aucun'}
`;

    // AI interprets the command and decides action
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Tu es l'assistant IA du directeur de SEGGUINÉE (société des eaux de Guinée).
Tu reçois des commandes en français du directeur et tu dois les exécuter.

Tu as accès aux actions suivantes:
- CREATE_INVOICE: créer une facture (params: customer_name, customer_phone, amount_gnf, description, due_date)
- SEND_WHATSAPP: envoyer un message WhatsApp (params: phone, message)
- LOG_INCIDENT: signaler un incident (params: type, description, zone, station, reported_by)
- ADD_PRODUCTION: ajouter un relevé de production (params: volume_m3, station, zone, recorded_by)
- SUMMARIZE: résumer les données actuelles (pas d'action externe)
- SEND_REMINDER: envoyer rappel aux clients en retard (pas de params nécessaires)
- UNKNOWN: commande non reconnue

Réponds UNIQUEMENT avec du JSON valide dans ce format exact:
{
  "action": "ACTION_NAME",
  "params": {},
  "explanation": "Ce que tu vas faire en 1 phrase",
  "message_to_director": "Confirmation concise pour le directeur"
}`,
        },
        {
          role: 'user',
          content: `Contexte:\n${context}\n\nCommande du directeur: "${command}"`,
        },
      ],
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { action: 'UNKNOWN', explanation: raw, message_to_director: raw }; }

    const { action, params, explanation, message_to_director } = parsed;
    let result = message_to_director || explanation || 'Commande traitée';
    let action_taken = action;

    // Execute the action
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
      result = `✓ Facture ${ref} créée pour ${params.customer_name} — ${Number(params.amount_gnf).toLocaleString('fr-FR')} GNF`;
      if (params.customer_phone) {
        await sendMessage(params.customer_phone, `Bonjour ${params.customer_name}, votre facture de ${Number(params.amount_gnf).toLocaleString('fr-FR')} GNF a été créée. Référence: ${ref}`).catch(() => null);
      }
    }

    else if (action === 'SEND_WHATSAPP') {
      const phone = params.phone || DIRECTOR_PHONE;
      await sendMessage(phone, params.message || explanation);
      result = `✓ Message WhatsApp envoyé à ${phone}`;
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
      result = `✓ Incident ${ref} signalé — ${params.type} à ${params.zone}`;
    }

    else if (action === 'ADD_PRODUCTION') {
      await atCreate('production', {
        Volume_m3:   Number(params.volume_m3) || 0,
        Station:     params.station     || '',
        Zone:        params.zone        || '',
        Recorded_by: params.recorded_by || 'Directeur',
        Recorded_at: new Date().toISOString(),
      });
      result = `✓ Relevé enregistré — ${params.volume_m3} m³ à ${params.station}`;
    }

    else if (action === 'SEND_REMINDER') {
      const overdue = await atList('invoices', { filterByFormula: "{Status}='overdue'", maxRecords: 20 });
      const pending = await atList('invoices', { filterByFormula: "{Status}='pending'", maxRecords: 20 });
      const targets = [...overdue, ...pending].filter(r => r.fields.Customer_phone);
      let sent = 0;
      for (const inv of targets) {
        const msg = `Bonjour ${inv.fields.Customer_name || ''}, rappel de paiement SEGGUINÉE: ${Number(inv.fields.Amount_GNF).toLocaleString('fr-FR')} GNF (réf: ${inv.fields.Reference}). Merci de régulariser.`;
        await sendMessage(inv.fields.Customer_phone, msg).catch(() => null);
        sent++;
      }
      result = `✓ Rappels envoyés à ${sent} client${sent > 1 ? 's' : ''}`;
    }

    else if (action === 'SUMMARIZE') {
      const pendingAmt = invoices.filter(r => r.fields.Status === 'pending').reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
      const paidAmt = invoices.filter(r => r.fields.Status === 'paid').reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
      result = `Résumé SEGGUINÉE — Collecté: ${paidAmt.toLocaleString('fr-FR')} GNF | En attente: ${pendingAmt.toLocaleString('fr-FR')} GNF | Incidents ouverts: ${incidents.length} | Production récente: ${production[0]?.fields.Volume_m3 ?? '?'} m³`;
    }

    // Save result
    await atUpdate('tasks', taskId, {
      Status:      'done',
      Result:      result,
      Action_taken: action_taken,
      Executed_at: new Date().toISOString(),
    });

    return NextResponse.json({ id: taskId, status: 'done', result, action: action_taken });

  } catch (e: any) {
    await atUpdate('tasks', taskId, { Status: 'failed', Result: e.message }).catch(() => null);
    return NextResponse.json({ id: taskId, status: 'failed', result: e.message }, { status: 500 });
  }
}
