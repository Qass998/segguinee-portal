/**
 * API Route: /api/webhook/whatsapp
 * Meta WhatsApp Cloud API webhook handler.
 *   GET  → Meta webhook verification
 *   POST → Inbound messages → AI determines sender role → routes accordingly
 */

import { NextRequest, NextResponse } from "next/server";
import { atList, atCreate, atUpdate, TABLES } from "@/lib/airtable";
import { sendMessage } from "@/lib/whatsapp";

const DIRECTOR_PHONE = process.env.SEGGUINEE_DIRECTOR_PHONE || "";

// ── GET — Meta webhook verification ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "Pluggedin";
  const mode      = req.nextUrl.searchParams.get("hub.mode");
  const token     = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Webhook] Meta verified ✓");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

// ── POST — inbound messages ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("[Webhook] Inbound:", JSON.stringify(payload).slice(0, 400));
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        for (const msg of change?.value?.messages || []) {
          const from        = msg.from as string;
          const body        = (msg.text?.body || "").trim();
          const profileName = change?.value?.contacts?.[0]?.profile?.name || "";
          if (from && body) await routeMessage(from, body, profileName);
        }
      }
    }
    return NextResponse.json({ status: "handled" });
  } catch (e: any) {
    console.error("[Webhook] Error:", e.message);
    return NextResponse.json({ status: "error", detail: e.message }, { status: 500 });
  }
}

// ── AGENTIC ROUTER ────────────────────────────────────────────────────────
async function routeMessage(from: string, body: string, profileName: string) {
  const isDirector = DIRECTOR_PHONE !== "" && from === DIRECTOR_PHONE;
  const now        = new Date().toISOString();

  // 1. Load context in parallel
  const [staffRecords, convRecords] = await Promise.all([
    atList("staff",         { filterByFormula: `{Phone}='${from}'`, maxRecords: 1 }),
    atList("conversations", { filterByFormula: `{Phone}='${from}'`, maxRecords: 1 }),
  ]);
  const staffFields = staffRecords[0]?.fields ?? null;
  const convRecord  = convRecords[0] ?? null;

  // 2. Upsert conversation
  if (convRecord) {
    await atUpdate("conversations", convRecord.id, {
      Last_message:    body.slice(0, 200),
      Last_message_at: now,
      ...(profileName ? { Profile_name: profileName } : {}),
    });
  } else {
    await atCreate("conversations", {
      Phone:           from,
      Profile_name:    profileName,
      Last_message:    body.slice(0, 200),
      Last_message_at: now,
      Unread_count:    1,
      Status:          "active",
      Is_director:     isDirector,
    });
  }

  // 3. Log inbound message
  await atCreate("messages", {
    Message_id:         `in_${Date.now()}`,
    Conversation_phone: from,
    Direction:          "inbound",
    Body:               body,
    Action:             "inbound",
    AI_generated:       false,
    Created_at:         now,
  });

  // 4. Route
  const { role, action, reply, dataPayload } = await classifyAndHandle(from, body, isDirector, staffFields);

  // 5. Store operational data
  if (dataPayload) await storeOperationalData(dataPayload, from);

  // 6. Send reply + log outbound
  if (reply) {
    await sendMessage(from, reply);
    const replyTime = new Date().toISOString();
    await atCreate("messages", {
      Message_id:         `out_${Date.now()}`,
      Conversation_phone: from,
      Direction:          "outbound",
      Body:               reply,
      Action:             `${role}:${action}`,
      AI_generated:       true,
      Created_at:         replyTime,
    });
    if (convRecord) {
      await atUpdate("conversations", convRecord.id, {
        Last_message:    reply.slice(0, 200),
        Last_message_at: replyTime,
      });
    }
  }

  console.log(`[Route] from=${from} role=${role} action=${action}`);
}

// ── CLASSIFICATION ────────────────────────────────────────────────────────
async function classifyAndHandle(
  from: string, body: string, isDirector: boolean, staffFields: any,
): Promise<{ role: string; action: string; reply: string; dataPayload?: { table: string; fields: Record<string, any> } }> {
  const msg = body.toLowerCase().trim();

  if (isDirector) {
    if (msg.includes("relance") && msg.includes("impay"))
      return { role: "director", action: "billing_reminders", reply: await handleBillingReminders(from) };
    if (msg === "briefing")
      return { role: "director", action: "briefing", reply: await compileBriefingFromDB() };
    if (msg === "go" || msg === "oui")
      return { role: "director", action: "approve", reply: "✅ Actions approuvées." };
    if (msg === "pause" || msg === "stop")
      return { role: "director", action: "pause", reply: "⏸️ Actions suspendues. GO pour reprendre." };
    const dataResult = tryParseOperationalData(body, staffFields);
    if (dataResult) return dataResult;
    return { role: "director", action: "unknown", reply: "Commandes: relance les impayés | briefing | GO | PAUSE" };
  }

  if (staffFields) {
    const dataResult = tryParseOperationalData(body, staffFields);
    if (dataResult) return dataResult;
    return { role: "staff", action: "chat", reply: `Bonjour ${staffFields.Name || ""}. En quoi puis-je vous aider ?` };
  }

  // Field agent commands — arrivée / rapport / départ / terminé
  const isFieldCommand = /^(arriv[eé]e?|rapport|d[eé]part|termin[eé])\s/i.test(body);
  if (isFieldCommand) {
    const result = await handleFieldCommand(from, body, staffFields);
    return { role: "field_agent", action: result.action, reply: result.reply };
  }

  const looksLikeData = /^(prod|facture|incident|paiement)\s/i.test(body);
  if (looksLikeData) {
    const dataResult = tryParseOperationalData(body, null);
    if (dataResult) {
      return {
        role: "unknown_staff", action: "data_then_intro",
        reply: dataResult.reply + "\n\nJe ne vous ai pas encore dans le système. Quel est votre nom et rôle ? (ex: agent Kaloum, technicien Dixinn...)",
        dataPayload: dataResult.dataPayload,
      };
    }
  }

  return { role: "customer", action: "inquiry", reply: await handleCustomerInquiry(from, body) };
}

// ── OPERATIONAL DATA PARSER ───────────────────────────────────────────────
function tryParseOperationalData(
  body: string, staff: any,
): { role: string; action: string; reply: string; dataPayload?: { table: string; fields: Record<string, any> } } | null {
  const prodMatch = body.match(/^prod\s+(\d+)\s+(.+)/i);
  if (prodMatch) {
    const volume = parseInt(prodMatch[1]);
    const station = prodMatch[2].trim();
    return {
      role: staff ? "staff" : "unknown", action: "production_logged",
      reply: `✅ Production enregistrée: ${volume.toLocaleString("fr-FR")} m³ à ${station}.\nDate: ${new Date().toLocaleDateString("fr-FR")}`,
      dataPayload: { table: "production", fields: { Volume_m3: volume, Station: station, Zone: staff?.Zone || station, Recorded_by: staff?.Phone || "", Reference: `PROD-${Date.now()}`, Recorded_at: new Date().toISOString() } },
    };
  }

  const factureMatch = body.match(/^facture\s+(\d+)\s+(\d+)/i);
  if (factureMatch) {
    const phone = factureMatch[1]; const amount = parseInt(factureMatch[2]);
    return {
      role: staff ? "staff" : "unknown", action: "invoice_created",
      reply: `📄 Facture créée: ${amount.toLocaleString("fr-FR")} GNF — Client: ${phone}\nStatut: En attente.`,
      dataPayload: { table: "invoices", fields: { Customer_phone: phone, Amount_GNF: amount, Status: "pending", Reference: `INV-${Date.now()}`, Created_at: new Date().toISOString() } },
    };
  }

  const incidentMatch = body.match(/^incident\s+(\w+)\s+(.+)/i);
  if (incidentMatch) {
    const type = normalizeIncidentType(incidentMatch[1]);
    const desc = incidentMatch[2].trim();
    const zone = staff?.Zone || extractZone(desc);
    return {
      role: staff ? "staff" : "unknown", action: "incident_reported",
      reply: `🚨 Incident signalé: ${type} — ${desc}\nZone: ${zone || "inconnue"}\nStatut: En cours d'examen.`,
      dataPayload: { table: "incidents", fields: { Type: type, Description: desc, Zone: zone, Reported_by: staff?.Phone || "", Status: "open", Reference: `INC-${Date.now()}`, Created_at: new Date().toISOString() } },
    };
  }

  const paiementMatch = body.match(/^paiement\s+(\d+)\s+(\d+)/i);
  if (paiementMatch) {
    const phone = paiementMatch[1]; const amount = parseInt(paiementMatch[2]);
    return {
      role: staff ? "staff" : "unknown", action: "payment_recorded",
      reply: `💰 Paiement enregistré: ${amount.toLocaleString("fr-FR")} GNF de ${phone}.`,
      dataPayload: { table: "invoices_update", fields: { customer_phone: phone, amount_paid: amount } },
    };
  }

  return null;
}

// ── STORE OPERATIONAL DATA ────────────────────────────────────────────────
async function storeOperationalData(payload: { table: string; fields: Record<string, any> }, _from: string) {
  try {
    if (payload.table === "production") {
      await atCreate("production", payload.fields);
    } else if (payload.table === "invoices") {
      await atCreate("invoices", payload.fields);
    } else if (payload.table === "incidents") {
      await atCreate("incidents", payload.fields);
    } else if (payload.table === "invoices_update") {
      const records = await atList("invoices", {
        filterByFormula: `AND({Customer_phone}='${payload.fields.customer_phone}',{Status}='pending')`,
        maxRecords: 1,
      });
      if (records[0]) {
        await atUpdate("invoices", records[0].id, { Status: "paid", Paid_at: new Date().toISOString() });
      }
    }
    console.log(`[Data] Stored → ${payload.table}`);
  } catch (e: any) {
    console.error(`[Data] Storage error: ${e.message}`);
  }
}

// ── CUSTOMER INQUIRY ──────────────────────────────────────────────────────
async function handleCustomerInquiry(from: string, body: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const msg       = body.toLowerCase().trim();

  if (["bonjour", "bjr", "slt", "salut"].includes(msg))
    return "Bonjour 👋\n\nBienvenue au Service Client de la SEGGUINÉE. Comment pouvons-nous vous aider ?\n\n_SERVICE CLIENT SEGGUINÉE_";
  if (["merci", "ok", "d'accord"].includes(msg))
    return "Avec plaisir. N'hésitez pas si vous avez d'autres questions.\n\n_SERVICE CLIENT SEGGUINÉE_";

  const [invoiceRecords, incidentRecords, recentMsgRecords] = await Promise.all([
    atList("invoices",  { filterByFormula: `{Customer_phone}='${from}'`,                            sort: [{ field: "Created_at", direction: "desc" }], maxRecords: 20 }),
    atList("incidents", { filterByFormula: `OR({Status}='open',{Status}='in_progress')`,            sort: [{ field: "Created_at", direction: "desc" }], maxRecords: 5  }),
    atList("messages",  { filterByFormula: `{Conversation_phone}='${from}'`,                        sort: [{ field: "Created_at", direction: "desc" }], maxRecords: 6  }),
  ]);

  const invoices       = invoiceRecords.map(r => r.fields);
  const incidents      = incidentRecords.map(r => r.fields);
  const recentMessages = recentMsgRecords.map(r => r.fields);

  const unpaid      = invoices.filter(i => i.Status !== "paid");
  const paid        = invoices.filter(i => i.Status === "paid");
  const unpaidTotal = unpaid.reduce((s, i) => s + (i.Amount_GNF || 0), 0);

  if (/payé|paye|paiement|réglé/i.test(msg)) {
    if (unpaid.length === 0)
      return `Bonjour.\n\n✅ Aucune facture impayée trouvée pour votre numéro.\n\nSi vous avez effectué un paiement récent, il sera visible dans votre prochain relevé.\n\n_SERVICE CLIENT SEGGUINÉE_`;
    return `Bonjour.\n\n📋 Vous avez ${unpaid.length} facture(s) impayée(s) pour un total de ${unpaidTotal.toLocaleString("fr-FR")} GNF.\n\nPour confirmer un paiement, merci d'envoyer une capture du reçu.\n\n_SERVICE CLIENT SEGGUINÉE_`;
  }

  if (/solde|combien|dois|montant/i.test(msg)) {
    if (unpaid.length === 0)
      return `Bonjour.\n\n✅ Votre compte est à jour. Aucune facture en attente.\n\n_SERVICE CLIENT SEGGUINÉE_`;
    const lines = unpaid.slice(0, 5).map(i =>
      `• ${i.Reference || "Facture"} | ${i.Due_date ? new Date(i.Due_date).toLocaleDateString("fr-FR") : "—"} | ${(i.Amount_GNF || 0).toLocaleString("fr-FR")} GNF`
    );
    return `Bonjour.\n\n📋 *Votre situation:*\n${lines.join("\n")}${unpaid.length > 5 ? `\n...et ${unpaid.length - 5} autre(s).` : ""}\n\n*Total dû:* ${unpaidTotal.toLocaleString("fr-FR")} GNF\n\n_SERVICE CLIENT SEGGUINÉE_`;
  }

  if (/pas d.?eau|coupure|sèche|fuite|alerte/i.test(msg)) {
    const zone = extractZone(body);
    await atCreate("incidents", {
      Type: /fuite/i.test(msg) ? "fuite" : "panne",
      Description: body.slice(0, 300),
      Zone: zone,
      Reported_by: from,
      Status: "open",
      Reference: `INC-${Date.now()}`,
      Created_at: new Date().toISOString(),
    });
    return `🚨 Incident signalé et enregistré.\n\n${zone ? `Zone: ${zone}. ` : ""}Une équipe technique sera informée.\n\nRéférence: INC-${Date.now().toString(36).toUpperCase().slice(-6)}\n\n_SERVICE CLIENT SEGGUINÉE_`;
  }

  if (!openaiKey)
    return "Merci pour votre message. Un membre de notre équipe vous répondra dans les plus brefs délais.\n\n_SERVICE CLIENT SEGGUINÉE_";

  let ctx = `\n\n─── CONTEXTE CLIENT ───`;
  ctx += `\nNuméro: ${from}`;
  ctx += `\nFactures impayées: ${unpaid.length} (${unpaidTotal.toLocaleString("fr-FR")} GNF)`;
  if (unpaid.length > 0) ctx += `\nDétail: ${unpaid.slice(0,5).map(i => `${i.Reference||""} — ${(i.Amount_GNF||0).toLocaleString("fr-FR")} GNF`).join(" | ")}`;
  ctx += `\nFactures payées: ${paid.length}`;
  ctx += incidents.length > 0 ? `\nIncidents actifs: ${incidents.map(i => `${i.Type} — ${(i.Description||"").slice(0,60)} (${i.Zone})`).join(" | ")}` : `\nIncidents: Aucun actif.`;
  if (recentMessages.length > 0) ctx += `\nHistorique: ${recentMessages.slice(0,4).reverse().map(m => `[${m.Direction==="inbound"?"CLIENT":"AGENT"}]: ${(m.Body||"").slice(0,80)}`).join(" | ")}`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 350,
        messages: [
          { role: "system", content: `Tu es le Service Client de la SEGGUINÉE (eaux de Guinée). Français uniquement. Faits uniquement depuis le CONTEXTE. Max 3 phrases. Terminer par "_SERVICE CLIENT SEGGUINÉE_".${ctx}` },
          { role: "user",   content: body },
        ],
      }),
    });
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || "Merci pour votre message.\n\n_SERVICE CLIENT SEGGUINÉE_";
  } catch {
    return "Merci pour votre message.\n\n_SERVICE CLIENT SEGGUINÉE_";
  }
}

// ── BILLING REMINDERS ─────────────────────────────────────────────────────
async function handleBillingReminders(directorPhone: string): Promise<string> {
  const records = await atList("invoices", { filterByFormula: `{Status}='pending'`, maxRecords: 100 });
  if (records.length === 0) return "📋 Aucune facture impayée trouvée.";

  let sent = 0, skipped = 0;
  for (const rec of records) {
    const phone = rec.fields.Customer_phone;
    if (!phone) { skipped++; continue; }
    const reminder = `Bonjour,\n\nCeci est un rappel de la SEGGUINÉE concernant votre facture ${rec.fields.Reference || ""} d'un montant de ${(rec.fields.Amount_GNF || 0).toLocaleString("fr-FR")} GNF.\n\nMerci de bien vouloir régulariser votre situation.\n\nPour confirmer votre paiement, répondez à ce message.\n\n_SERVICE CLIENT SEGGUINÉE_`;
    const result = await sendMessage(phone, reminder);
    if (result.ok) sent++; else skipped++;
    await new Promise(r => setTimeout(r, 500));
  }

  await atCreate("billing_log", {
    Reference:      `BL-${Date.now()}`,
    Triggered_by:   directorPhone,
    Total_invoices: records.length,
    Sent_count:     sent,
    Skipped_count:  skipped,
    Created_at:     new Date().toISOString(),
  });

  return `📋 *Relance terminée*\n\n• Factures impayées: ${records.length}\n• Rappels envoyés: ${sent}\n• Sans numéro: ${skipped}`;
}

// ── DAILY BRIEFING ────────────────────────────────────────────────────────
async function compileBriefingFromDB(): Promise<string> {
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const [prodRecords, invoiceRecords, incidentRecords] = await Promise.all([
    atList("production", { sort: [{ field: "Recorded_at", direction: "desc" }], maxRecords: 1 }),
    atList("invoices",   { filterByFormula: `{Status}='pending'` }),
    atList("incidents",  { filterByFormula: `OR({Status}='open',{Status}='in_progress')` }),
  ]);

  const prodVol       = prodRecords[0]?.fields?.Volume_m3 || "N/A";
  const overdueCount  = invoiceRecords.length;
  const overdueTotal  = invoiceRecords.reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
  const activeIncidents = incidentRecords.length;

  let b = `📊 *SEGGUINÉE — Briefing Quotidien*\n_${today}_\n\n`;
  b += `*SITUATION:*\n• Production: ${prodVol} m³\n• Factures impayées: ${overdueCount} (${overdueTotal.toLocaleString("fr-FR")} GNF)\n• Incidents actifs: ${activeIncidents}\n`;

  if (activeIncidents > 0) {
    b += `\n*PRIORITÉ:* ${activeIncidents} incident(s) actif(s). Résoudre avant impact distribution.\n`;
    b += `*RECOMMANDATION:* Examiner les incidents et assigner les équipes.\n`;
  } else if (overdueCount > 5) {
    b += `\n*PRIORITÉ:* Recouvrement en retard.\n`;
    b += `*RECOMMANDATION:* Répondre RELANCE pour lancer les rappels.\n`;
  } else {
    b += `\n*PRIORITÉ:* Opérations stables.\n*RECOMMANDATION:* Pas d'action urgente.\n`;
  }

  b += `\n---\n_Répondez RELANCE pour les rappels. GO pour approuver._`;
  return b;
}

// ── FIELD AGENT COMMANDS ──────────────────────────────────────────────────
async function handleFieldCommand(
  from: string,
  body: string,
  staffFields: any,
): Promise<{ action: string; reply: string }> {
  const msg   = body.trim();
  const parts = msg.split(/\s+/);
  const cmd   = parts[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const rest  = parts.slice(1).join(' ').trim();
  const now   = new Date().toISOString();
  const time  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const name  = staffFields?.Name || '';

  let action  = 'rapport';
  let location = extractZone(rest) || rest.split(' ')[0] || '';
  let description = rest;
  let reply   = '';

  if (/^arriv/i.test(cmd)) {
    action = 'arrivée';
    reply  = `✅ Arrivée enregistrée${location ? ` — ${location}` : ''} à ${time}.\n\nEnvoyez *rapport [description]* pour logger votre intervention.\n\n_Agent Terrain SEGGUINÉE_`;
  } else if (/^d[eé]part/i.test(cmd)) {
    action = 'départ';
    reply  = `✅ Départ enregistré${location ? ` — ${location}` : ''} à ${time}.\n\nMerci ${name || ''}. À bientôt.\n\n_Agent Terrain SEGGUINÉE_`;
  } else if (/^termin/i.test(cmd)) {
    action = 'départ';
    reply  = `✅ Mission terminée à ${time}.\n\n${description ? `Mission: ${description}` : ''}\n\n_Agent Terrain SEGGUINÉE_`;
  } else {
    action = 'rapport';
    reply  = `✅ Rapport enregistré à ${time}.\n\n${description ? `"${description}"` : ''}\n\n_Agent Terrain SEGGUINÉE_`;
  }

  await atCreate('field_reports', {
    Reference:        `FR-${Date.now()}`,
    Technician_phone: from,
    Technician_name:  name,
    Action:           action,
    Location:         location,
    Description:      description,
    Created_at:       now,
  });

  // Notify director of field incidents
  const dirPhone = process.env.SEGGUINEE_DIRECTOR_PHONE || '';
  if (action === 'incident' && dirPhone) {
    await sendMessage(dirPhone,
      `🚨 *Incident terrain signalé*\n\nAgent: ${name || from}\nLieu: ${location || '?'}\nDétail: ${description}\nHeure: ${time}\n\n_Agent Terrain SEGGUINÉE_`
    );
  }

  return { action, reply };
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function normalizeIncidentType(input: string): string {
  return ({ rupture:"rupture", panne:"panne", contamination:"contamination", fuite:"fuite" })[input.toLowerCase()] || "autre";
}

function extractZone(text: string): string {
  for (const z of ["Kaloum","Dixinn","Matam","Ratoma","Matoto","Coyah","Dubréka","Kindia"]) {
    if (text.toLowerCase().includes(z.toLowerCase())) return z;
  }
  return "";
}
