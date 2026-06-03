import { NextResponse } from 'next/server';
import { atList } from '@/lib/airtable';

export async function GET() {
  try {
    // Latest insights from Agents_Log
    const logs = await atList('agents_log', {
      sort: [{ field: 'Heure_execution', direction: 'desc' }],
      maxRecords: 20,
    });

    // WhatsApp message count today
    const today = new Date().toISOString().slice(0, 10);
    const messages = await atList('messages', {
      filterByFormula: `IS_AFTER({Created_at}, '${today}')`,
      maxRecords: 500,
    });

    // Conversation count
    const conversations = await atList('conversations', { maxRecords: 500 });

    return NextResponse.json({
      logs: logs.map(r => {
        let insight = r.fields.Insight ?? '';
        insight = insight.replace(/£[\d,]+\/mois/gi, '').replace(/\$[\d,]+\/month/gi, '').trim();
        return {
          id:                 r.id,
          agent:              r.fields.Agent              ?? '',
          agent_id:           r.fields.Agent_id           ?? '',
          icon:               r.fields.Icon               ?? '🤖',
          statut:             r.fields.Statut             ?? 'actif',
          insight:            insight,
          derniere_execution: r.fields.Derniere_execution ?? '',
          heure_execution:    r.fields.Heure_execution    ?? '',
        };
      }),
      stats: {
        messages_today:     messages.length,
        total_conversations: conversations.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
