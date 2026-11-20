import { create } from "zustand";

export interface ConfirmSpec {
  title: string;
  body?: string;
  /** Name the action, never a generic OK for a destructive operation. */
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

interface QueuedConfirm extends ConfirmSpec {
  id: number;
}
interface ConfirmState { queue: QueuedConfirm[] }

const useConfirmStore = create<ConfirmState>(() => ({ queue: [] }));
const resolvers = new Map<number, (answer: boolean) => void>();
let nextConfirmId = 1;

/**
 * App-owned confirmations on every platform. In particular, browser/iframe preview
 * restrictions cannot silently turn a destructive action into a no-op.
 * Requests are queued rather than replacing an unresolved confirmation.
 */
export function confirmAction(spec: ConfirmSpec): Promise<boolean> {
  return new Promise((resolve) => {
    const id = nextConfirmId++;
    resolvers.set(id, resolve);
    useConfirmStore.setState((state) => ({ queue: [...state.queue, { ...spec, id }] }));
  });
}

export function currentConfirmation(): QueuedConfirm | undefined {
  return useConfirmStore.getState().queue[0];
}

export function useCurrentConfirmation(): QueuedConfirm | undefined {
  return useConfirmStore((state) => state.queue[0]);
}

/** First response wins, including a double tap on the destructive button. */
export function answerConfirmation(id: number, answer: boolean): void {
  if (useConfirmStore.getState().queue[0]?.id !== id) return;
  const resolve = resolvers.get(id);
  resolvers.delete(id);
  useConfirmStore.setState((state) => ({ queue: state.queue.slice(1) }));
  resolve?.(answer);
}

/** A host unmount must not leave callers awaiting a confirmation forever. */
export function cancelConfirmations(): void {
  const pending = Array.from(resolvers.values());
  resolvers.clear();
  useConfirmStore.setState({ queue: [] });
  for (const resolve of pending) resolve(false);
}
