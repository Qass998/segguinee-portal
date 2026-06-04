# Graph Report - src  (2026-06-04)

## Corpus Check
- Corpus is ~13,684 words - fits in a single context window. You may not need a graph.

## Summary
- 135 nodes · 235 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard Shell|Dashboard Shell]]
- [[_COMMUNITY_Airtable Client|Airtable Client]]
- [[_COMMUNITY_Invoice API|Invoice API]]
- [[_COMMUNITY_WhatsApp Webhook|WhatsApp Webhook]]
- [[_COMMUNITY_Production API|Production API]]
- [[_COMMUNITY_Incidents API|Incidents API]]
- [[_COMMUNITY_Agent Log API|Agent Log API]]
- [[_COMMUNITY_Auth & Login|Auth & Login]]
- [[_COMMUNITY_Conversations API|Conversations API]]
- [[_COMMUNITY_Projects API|Projects API]]
- [[_COMMUNITY_Cron Jobs|Cron Jobs]]

## God Nodes (most connected - your core abstractions)
1. `atList()` - 40 edges
2. `atCreate()` - 24 edges
3. `sendMessage()` - 15 edges
4. `atUpdate()` - 9 edges
5. `routeMessage()` - 8 edges
6. `classifyAndHandle()` - 7 edges
7. `storeOperationalData()` - 5 edges
8. `handleCustomerInquiry()` - 5 edges
9. `handleBillingReminders()` - 5 edges
10. `handleFieldCommand()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `atCreate()`  [EXTRACTED]
  app/api/data/field-reports/route.ts → lib/airtable.ts
- `POST()` --calls--> `atCreate()`  [EXTRACTED]
  app/api/data/incidents/route.ts → lib/airtable.ts
- `GET()` --calls--> `atList()`  [EXTRACTED]
  app/api/data/invoices/route.ts → lib/airtable.ts
- `POST()` --calls--> `atCreate()`  [EXTRACTED]
  app/api/data/production/route.ts → lib/airtable.ts
- `POST()` --calls--> `atCreate()`  [EXTRACTED]
  app/api/data/projects/route.ts → lib/airtable.ts

## Import Cycles
- None detected.

## Communities (15 total, 4 thin omitted)

### Community 0 - "Dashboard Shell"
Cohesion: 0.11
Nodes (21): GET(), POST(), GET(), PATCH(), GET(), POST(), GET(), GET() (+13 more)

### Community 1 - "Airtable Client"
Cohesion: 0.06
Nodes (14): Agent, INC_TYPES, Incident, inp, Invoice, lbl, ProductionEntry, PROJ_STATUS (+6 more)

### Community 2 - "Invoice API"
Cohesion: 0.24
Nodes (8): generateBriefing(), GET(), GET(), GET(), POST(), sendMessage(), SendResult, POST()

### Community 3 - "WhatsApp Webhook"
Cohesion: 0.33
Nodes (12): atCreate(), classifyAndHandle(), compileBriefingFromDB(), extractZone(), handleBillingReminders(), handleCustomerInquiry(), handleFieldCommand(), normalizeIncidentType() (+4 more)

### Community 4 - "Production API"
Cohesion: 0.32
Nodes (4): fmtGNF(), metadata, pct(), ReportPage()

### Community 5 - "Incidents API"
Cohesion: 0.38
Nodes (4): fmt(), fmtGNF(), metadata, SignPage()

### Community 6 - "Agent Log API"
Cohesion: 0.40
Nodes (3): dmSans, jetbrainsMono, metadata

## Knowledge Gaps
- **23 isolated node(s):** `ProductionEntry`, `Invoice`, `Incident`, `Agent`, `Projet` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `atList()` connect `Dashboard Shell` to `Invoice API`, `WhatsApp Webhook`, `Production API`, `Incidents API`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `atCreate()` connect `WhatsApp Webhook` to `Dashboard Shell`, `Invoice API`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `sendMessage()` connect `Invoice API` to `Dashboard Shell`, `WhatsApp Webhook`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `ProductionEntry`, `Invoice`, `Incident` to the rest of the system?**
  _23 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard Shell` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._
- **Should `Airtable Client` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._