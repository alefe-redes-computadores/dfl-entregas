import type { DeliveryInboxDraft } from '@/lib/delivery-inbox';

export type InboxView = 'todos' | 'revisar' | 'prontos';

/** UI-only: never changes stored drafts or import/deduplication semantics. */
export function classifyInboxDrafts<T extends Pick<DeliveryInboxDraft, 'status'>>(drafts: readonly T[]) {
  const active: T[] = [];
  const ready: T[] = [];
  const review: T[] = [];
  const launched: T[] = [];
  const discarded: T[] = [];
  for (const draft of drafts) {
    if (draft.status === 'discarded') { discarded.push(draft); continue; }
    if (draft.status === 'launched') { launched.push(draft); continue; }
    active.push(draft);
    if (draft.status === 'review') review.push(draft);
    if (draft.status === 'ready') ready.push(draft);
  }
  return { active, ready, review, launched, discarded };
}

export function inboxViewDrafts<T extends Pick<DeliveryInboxDraft, 'status'>>(
  classified: ReturnType<typeof classifyInboxDrafts<T>>,
  view: InboxView,
): readonly T[] {
  if (view === 'revisar') return classified.review;
  if (view === 'prontos') return classified.ready;
  return classified.active;
}
