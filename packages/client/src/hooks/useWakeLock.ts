import { useEffect } from 'react';

// Keeps the screen on while enabled. The browser drops the lock whenever the
// page is hidden, so it is taken again when the page comes back.
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) {
      return undefined;
    }
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const request = async () => {
      if (document.visibilityState !== 'visible' || lock?.released === false) {
        return;
      }
      lock = await navigator.wakeLock.request('screen').catch(() => null);
      if (stopped) {
        void lock?.release();
      }
    };
    const onVisibilityChange = () => {
      void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void lock?.release();
    };
  }, [enabled]);
}
