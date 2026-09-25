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
type Theme = "light" | "dark";
type PrefSnapshot = { sound: boolean; theme: Theme };

const serverSnapshot: PrefSnapshot = { sound: false, theme: "light" };
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
  let theme: Theme = "light";
  try {
    sound = localStorage.getItem("rapigents-sound") === "on";
    theme = localStorage.getItem("rapigents-theme") === "dark" ? "dark" : "light";
  } catch {
    // Storage can be blocked. Keep the default off.
  }
  return { sound, theme };
}

type Prefs = {
  sound: boolean;
  toggleSound: () => void;
  theme: Theme;
  toggleTheme: () => void;
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
    document.documentElement.dataset.theme = stored.theme;
    if (stored.sound !== snapshot.sound || stored.theme !== snapshot.theme) {
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
      emit({ ...snapshot, sound: true });
      playClick();
    } else {
      playClick();
      emit({ ...snapshot, sound: false });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = snapshot.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("rapigents-theme", next);
    } catch {
      // Ignore storage failures. The theme still changes for this visit.
    }
    document.documentElement.dataset.theme = next;
    emit({ ...snapshot, theme: next });
  }, []);

  const value = useMemo(
    () => ({
      sound: prefs.sound,
      toggleSound,
      theme: prefs.theme,
      toggleTheme,
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
