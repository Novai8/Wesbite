"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { playClick, setSoundEnabled } from "@/lib/sound";

type ToastItem = { id: number; message: string };
type PrefSnapshot = { sound: boolean };

const serverSnapshot: PrefSnapshot = { sound: false };
let snapshot: PrefSnapshot = serverSnapshot;
const listeners = new Set<() => void>();

function emit(next: PrefSnapshot) {
  snapshot = next;
  setSoundEnabled(next.sound);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return serverSnapshot;
}

function readStoredPrefs(): PrefSnapshot {
  let sound = false;
  try {
    sound = localStorage.getItem("rapigents-sound") === "on";
  } catch {
    // Storage can be blocked. Keep the default off.
  }
  return { sound };
}

type Prefs = {
  sound: boolean;
  toggleSound: () => void;
  toast: (message: string) => void;
};

const PrefsContext = createContext<Prefs | null>(null);

export function usePrefs() {
  const value = useContext(PrefsContext);
  if (!value) {
    throw new Error("usePrefs must be used within Providers");
  }
  return value;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    const stored = readStoredPrefs();
    if (stored.sound !== snapshot.sound) {
      emit(stored);
    } else {
      setSoundEnabled(stored.sound);
    }
  }, []);

  useEffect(() => {
    if (!prefs.sound) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a, button, [data-sfx], summary, [role='button']")) {
        playClick();
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [prefs.sound]);

  const toast = useCallback((message: string) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !snapshot.sound;
    try {
      localStorage.setItem("rapigents-sound", next ? "on" : "off");
    } catch {
      // Ignore storage failures. The toggle still works for this visit.
    }
    if (next) {
      emit({ sound: true });
      playClick();
    } else {
      playClick();
      emit({ sound: false });
    }
  }, []);

  const value = useMemo(
    () => ({
      sound: prefs.sound,
      toggleSound,
      toast,
    }),
    [prefs.sound, toggleSound, toast],
  );

  return (
    <PrefsContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
        {toasts.map((item) => (
          <div key={item.id} className="toast" role="status">
            {item.message}
          </div>
        ))}
      </div>
    </PrefsContext.Provider>
  );
}
