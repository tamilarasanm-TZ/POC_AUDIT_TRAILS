import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  ip?: string | null;
  ua?: string | null;
  method?: string | null;
  url?: string | null;
  // Set to true to skip auto-audit for everything in this request scope
  skipAudit?: boolean;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

// Mutates the current context (e.g., after JWT validation fills in the actor).
// Safe because each request has its own ALS store.
export function patchRequestContext(patch: Partial<RequestContext>): void {
  const store = requestContextStorage.getStore();
  if (store) Object.assign(store, patch);
}
