# Firebase-first Architecture (MVP)

## Goals
- Keep initial cost at zero by using Firebase free tier.
- Preserve migration path by isolating provider-specific code under adapters.
- Support event-critical workflows: access expiry/revoke, preselection ranking, tie detection, run order, and battle progression.

## Code Boundaries
- `packages/domain`: pure rules and entities (provider-agnostic).
- `packages/application`: use cases and ports (provider-agnostic).
- `packages/adapters-firebase`: Firestore/Firebase implementation of ports.
- `apps/web`: user interfaces for creator, organizer, host, judge.

## Firestore Logical Model
- `events/{eventId}`
- `events/{eventId}/organizerAccess/{organizerId}`
- `categories/{categoryId}`
- `categories/{categoryId}/participants/{participantId}`
- `categories/{categoryId}/runtime/runOrder`

## Access Expiration
- Save `expiresAtIso` in organizer access document.
- Validate at every sensitive operation in application service.
- Revoke manually from creator dashboard.
- Add scheduled cleanup once moving beyond free-only baseline.

## Migration Strategy
- Keep domain and application packages unchanged.
- Replace adapter package and data mapping only.
- Maintain API/use-case contract in web layer.
