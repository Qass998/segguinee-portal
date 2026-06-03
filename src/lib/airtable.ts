const BASE_ID = process.env.SEGGUINEE_AIRTABLE_BASE ?? '';
const TOKEN   = process.env.AIRTABLE_TOKEN ?? '';
const API     = `https://api.airtable.com/v0/${BASE_ID}`;

export const TABLES = {
  conversations: 'tblPfNxS1NI1PltHQ',
  messages:      'tblrWWPlhX1xn8P4X',
  production:    'tbl9XOepDJEeVg8IN',
  incidents:     'tbl24E7JnKZPZJM08',
  invoices:      'tblKZJ4KRxVQDnmW8',
  staff:         'tbl8StduMMH4p6i6n',
  billing_log:   'tblvnElIDuKD923Dq',
  projects:      'tblyCYVNIDHjRtazG',
  agents_log:     'tblHXVwNrq1bhY6Qn',
  monthly_reports:'tblCDh8goqrw0LOrp',
  field_reports:  'tblGUdjtu6v6CtGyr',
} as const;

type TableKey = keyof typeof TABLES;
type AirtableRecord = { id: string; fields: Record<string, any> };

function headers() {
  return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
}

export async function atList(
  table: TableKey,
  opts?: {
    sort?: { field: string; direction?: 'asc' | 'desc' }[];
    filterByFormula?: string;
    maxRecords?: number;
  }
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  if (opts?.filterByFormula) params.set('filterByFormula', opts.filterByFormula);
  if (opts?.maxRecords)      params.set('maxRecords', String(opts.maxRecords));
  opts?.sort?.forEach((s, i) => {
    params.set(`sort[${i}][field]`,     s.field);
    params.set(`sort[${i}][direction]`, s.direction ?? 'asc');
  });
  const res = await fetch(`${API}/${TABLES[table]}?${params}`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Airtable list ${table}: ${res.status}`);
  const data = await res.json();
  return data.records ?? [];
}

export async function atCreate(
  table: TableKey,
  fields: Record<string, any>
): Promise<AirtableRecord> {
  const res = await fetch(`${API}/${TABLES[table]}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable create ${table}: ${res.status}`);
  return res.json();
}

export async function atUpdate(
  table: TableKey,
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  const res = await fetch(`${API}/${TABLES[table]}/${recordId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable update ${table}: ${res.status}`);
}
