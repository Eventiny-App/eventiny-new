# Free-Tier Guardrails

## Principles
- Prefer client-side or lightweight operations for MVP.
- Avoid high-frequency writes and expensive fan-out listeners.
- Keep payloads minimal and avoid redundant denormalized writes.

## Guardrails
1. Cap active events during pilot phase.
2. Cap judges per category in MVP test events.
3. Batch non-critical updates where possible.
4. Keep PDF export disabled in MVP (CSV/XLSX first).
5. Track firestore reads/writes in Firebase dashboard weekly.
6. Add hard quotas in app settings to prevent accidental usage spikes.

## Triggers to Move Off Free Tier
- Realtime latency or dropouts during live rounds.
- Frequent quota warnings near event days.
- Number of concurrent judges exceeds stable threshold in testing.
