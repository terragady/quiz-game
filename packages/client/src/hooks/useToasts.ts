import { useCallback, useRef, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
}

const DEFAULT_TOAST_MS = 4000;

export function useToasts(durationMs = DEFAULT_TOAST_MS) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message }]);
      setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss, durationMs],
  );

  return { toasts, push, dismiss };
}
