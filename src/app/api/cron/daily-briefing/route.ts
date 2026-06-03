/**
 * /api/cron/daily-briefing
 *
 * Runs daily at 07:00 Guinea time (UTC+0 → cron schedule: 0 7 * * *).
 * Vercel triggers this automatically and passes CRON_SECRET as Bearer token.
 *
 * What it does:
 *   1. Reads all operational data from Airtable
 *   2. Calls GPT-4o-mini to generate SITUATION / PRIORITÉ / RECOMMANDATION
 *   3. Sends the briefing to the director via WhatsApp
 *   4. Logs the run to Agents_Log
 */

import { NextRequest, NextResponse } from "next/server";
import { atList, atCreate } from "@/lib/airtable";
import { sendMessage } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (auto-set by Vercel on cron triggers)
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const directorPhone = process.env.SEGGUINEE_DIRECTOR_PHONE || "";
  if (!directorPhone) {
    return NextResponse.json({ error: "SEGGUINEE_DIRECTOR_PHONE not set" }, { status: 500 });
  }

  try {
    const briefing = await generateBriefing();

    // Send to director via WhatsApp
    const result = await sendMessage(directorPhone, briefing);

    // Log to Agents_Log
    const now = new Date();
    await atCreate("agents_log", {
      Agent:              "Agent Analyse",
      Agent_id:           "data_analyser",
      Icon:               "📊",
      Statut:             result.ok ? "actif" : "alerte",
      Insight:            briefing,
      Derniere_execution: "Briefing automatique 07h00",
      Heure_execution:    now.toISOString(),
    });

    console.log(`[Cron] Daily briefing sent to ${directorPhone} — status: ${result.ok}`);
    return NextResponse.json({ ok: true, sent: result.ok, timestamp: now.toISOString() });
  } catch (e: any) {
    console.error("[Cron] Daily briefing failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function generateBriefing(): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY || "";

  // Fetch all data in parallel
  const [prodRecords, invoiceRecords, incidentRecords, projectRecords, convRecords] = await Promise.all([
    atList("production", { sort: [{ field: "Recorded_at", direction: "desc" }], maxRecords: 5 }),
    atList("invoices",   { filterByFormula: `OR({Status}='pending',{Status}='overdue')`, maxRecords: 200 }),
    atList("incidents",  { filterByFormula: `OR({Status}='open',{Status}='in_progress')` }),
    atList("projects",   { filterByFormula: `{Statut}='en_cours'` }),
    atList("conversations", { maxRecords: 200 }),
  ]);

  // Summarise
  const latestProd    = prodRecords[0]?.fields;
  const prevProd      = prodRecords[1]?.fields;
  const pendingTotal  = invoiceRecords.reduce((s, r) => s + (r.fields.Amount_GNF || 0), 0);
  const overdueCount  = invoiceRecords.filter(r => r.fields.Status === "overdue").length;
  const activeInc     = incidentRecords.length;
  const activeProj    = projectRecords.length;
  const totalConvs    = convRecords.length;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  let briefingText = "";

  if (openaiKey) {
    // Volume trend
    const volTrend = latestProd && prevProd
      ? `Production: ${latestProd.Volume_m3} m³ (précédent: ${prevProd.Volume_m3} m³)`
      : latestProd
        ? `Production dernière entrée: ${latestProd.Volume_m3} m³ à ${latestProd.Station}`
        : "Production: aucune donnée récente";

    const dataCtx = [
      volTrend,
      `Factures en attente: ${invoiceRecords.length} (${pendingTotal.toLocaleString("fr-FR")} GNF total)`,
      overdueCount > 0 ? `Dont en retard: ${overdueCount}` : "",
      `Incidents actifs: ${activeInc}${activeInc > 0 ? " — " + incidentRecords.slice(0, 2).map(r => `${r.fields.Type} à ${r.fields.Zone || r.fields.Station || "?"}`).join(", ") : ""}`,
      `Projets en cours: ${activeProj}${activeProj > 0 ? " — " + projectRecords.slice(0, 2).map(r => r.fields.Nom).join(", ") : ""}`,
      `Conversations WhatsApp actives: ${totalConvs}`,
    ].filter(Boolean).join("\n");

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content: `Tu es l'Agent Analyse de SEGGUINÉE. Tu envoies le briefing opérationnel quotidien au directeur via WhatsApp.

Format EXACT (respecter les astérisques WhatsApp pour le gras):
📊 *SEGGUINÉE — Briefing ${today}*

*SITUATION:* [2 faits clés avec chiffres]
*PRIORITÉ:* [1 seule chose urgente]
*RECOMMANDATION:* [action précise d'aujourd'hui]
*RÉSULTAT ATTENDU:* [ce qui change si on agit]

---
_Répondez GO pour approuver · PAUSE pour suspendre_

Français uniquement. Concis. Factuel. Maximum 200 mots.`,
            },
            { role: "user", content: `DONNÉES OPÉRATIONNELLES:\n${dataCtx}` },
          ],
        }),
      });
      const data = await resp.json();
      briefingText = data.choices?.[0]?.message?.content?.trim() || "";
    } catch {
      // Fall through to rule-based
    }
  }

  // Rule-based fallback
  if (!briefingText) {
    const lines = [
      `📊 *SEGGUINÉE — Briefing ${today}*`,
      "",
      `*SITUATION:* ${invoiceRecords.length} facture(s) impayée(s) pour ${pendingTotal.toLocaleString("fr-FR")} GNF. ${activeInc} incident(s) actif(s).`,
    ];

    if (activeInc > 0) {
      lines.push(`*PRIORITÉ:* Résoudre les ${activeInc} incident(s) actif(s) avant impact sur la distribution.`);
      lines.push(`*RECOMMANDATION:* Vérifier l'état des équipes terrain et assigner les interventions.`);
      lines.push(`*RÉSULTAT ATTENDU:* Distribution stabilisée dans la journée.`);
    } else if (invoiceRecords.length > 5) {
      lines.push(`*PRIORITÉ:* Recouvrement — ${invoiceRecords.length} factures en attente.`);
      lines.push(`*RECOMMANDATION:* Lancer les relances WhatsApp depuis le portail.`);
      lines.push(`*RÉSULTAT ATTENDU:* Réduction des impayés sous 7 jours.`);
    } else {
      lines.push(`*PRIORITÉ:* Opérations stables — aucune anomalie critique.`);
      lines.push(`*RECOMMANDATION:* Maintenir la fréquence des relevés de production.`);
      lines.push(`*RÉSULTAT ATTENDU:* Continuité du service sans interruption.`);
    }

    lines.push("", "---", "_Répondez GO pour approuver · PAUSE pour suspendre_");
    briefingText = lines.join("\n");
  }

  return briefingText;
}
