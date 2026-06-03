/**
 * lib/agent.ts — SEGGUINÉE AI Agent (OpenAI GPT-4o-mini)
 *
 * Handles:
 *   - Customer inquiries (French only, facts only, never negotiate)
 *   - Daily briefing compilation (S/P/R/EO format)
 *
 * The operational prompt is tight: no promises, no price negotiation,
 * escalate disputes to director. Government-adjacent compliance.
 */

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

const SYSTEM_PROMPT = `Tu es l'assistant virtuel de la SEGGUINÉE, la société nationale des eaux de Guinée. Tu réponds aux clients par WhatsApp.

RÈGLES STRICTES:
1. Réponds TOUJOURS en français.
2. Donne uniquement des informations factuelles. Pas d'opinions.
3. Ne négocie JAMAIS les prix ou les conditions de paiement.
4. Ne fais JAMAIS de promesses (délais, remboursements, réparations).
5. Si le client est en colère ou conteste une facture: transfère au directeur. Dis "Je transmets votre message au directeur. Il vous contactera dans les plus brefs délais."
6. Si le client demande une intervention technique: dis "Je signale votre demande au service technique. Référence: [date du jour]."
7. Reste poli, professionnel, concis. Maximum 3 phrases.
8. Termine par "_Service Client SEGGUINÉE_"`;

/**
 * Generate an AI reply to a customer inquiry.
 */
export async function generateReply(body: string): Promise<string> {
  if (!OPENAI_KEY) {
    return "Merci pour votre message. Un membre de notre équipe vous répondra dans les plus brefs délais.\n\n_Service Client SEGGUINÉE_";
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: body },
        ],
      }),
    });

    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim() || fallbackReply();
  } catch {
    return fallbackReply();
  }
}

function fallbackReply(): string {
  return "Merci pour votre message. Nous vous répondrons dans les plus brefs délais.\n\n_Service Client SEGGUINÉE_";
}

/**
 * Quick keyword checks before calling AI.
 * Returns a reply if we can answer without AI, or null to fall through.
 */
export function quickReply(body: string): string | null {
  const msg = body.toLowerCase().trim();

  if (["bonjour", "bjr", "slt", "salut", "hello", "hi"].includes(msg)) {
    return "Bonjour 👋\n\nBienvenue au Service Client de la SEGGUINÉE. Comment pouvons-nous vous aider ?\n\n_Service Client SEGGUINÉE_";
  }

  if (["merci", "ok", "d'accord", "bien", "compris"].includes(msg)) {
    return "Avec plaisir. N'hésitez pas si vous avez d'autres questions.\n\n_Service Client SEGGUINÉE_";
  }

  return null; // Needs AI
}

/**
 * Compile the daily 7am briefing (S/P/R/EO format, French).
 * Called by the Vercel cron job or director command "briefing".
 */
export function compileBriefing(data: {
  overdueCount: number;
  overdueTotal: number;
  productionM3: string;
  activeIncidents: number;
  incidentNames: string[];
}): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let briefing = `📊 *SEGGUINÉE — Briefing Quotidien*\n_${today}_\n\n`;

  // Situation
  briefing += `*SITUATION:*\n`;
  briefing += `• Production: ${data.productionM3} m³ (dernier relevé)\n`;
  briefing += `• Factures impayées: ${data.overdueCount} (${data.overdueTotal.toLocaleString("fr-FR")} GNF)\n`;
  briefing += `• Incidents actifs: ${data.activeIncidents}`;
  if (data.incidentNames.length > 0) {
    briefing += ` — ${data.incidentNames.slice(0, 3).join(", ")}`;
  }
  briefing += "\n";

  // Priority
  if (data.activeIncidents > 2) {
    briefing += "\n*PRIORITÉ:* Résoudre les incidents en cours avant qu'ils n'affectent la distribution.\n";
  } else if (data.overdueCount > 10) {
    briefing += "\n*PRIORITÉ:* Lancer une relance des impayés. Le recouvrement est en retard.\n";
  } else {
    briefing += "\n*PRIORITÉ:* Maintenir la production. Vérifier les relevés des stations.\n";
  }

  // Recommendation
  if (data.activeIncidents > 2) {
    briefing += "\n*RECOMMANDATION:* Examiner les incidents et assigner les équipes terrain.\n";
  } else if (data.overdueCount > 5) {
    briefing += "\n*RECOMMANDATION:* Répondre RELANCE pour envoyer les rappels de facturation.\n";
  } else {
    briefing += "\n*RECOMMANDATION:* Tout est stable. Pas d'action urgente requise.\n";
  }

  briefing += "\n---\n_Répondez RELANCE pour envoyer les rappels._\n";
  briefing += "_Répondez STATUT [région] pour un rapport par zone._\n";
  briefing += "_Répondez GO pour approuver les actions du jour._";

  return briefing;
}
