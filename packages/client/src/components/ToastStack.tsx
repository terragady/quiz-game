import type { Toast } from '../hooks/useToasts.js';

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="toast"
          onClick={() => onDismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
