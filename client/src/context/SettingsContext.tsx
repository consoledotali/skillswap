import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AppSettings = {
  pushNotifs: boolean;
  emailUpdates: boolean;
  msgAlerts: boolean;
};

type SettingsContextValue = AppSettings & {
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
};

const KEYS: Record<keyof AppSettings, string> = {
  pushNotifs:   "skillswap_push_notifs",
  emailUpdates: "skillswap_email_updates",
  msgAlerts:    "skillswap_msg_alerts",
};

function readBool(storageKey: string, defaultValue = true): boolean {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return defaultValue;
  return raw !== "0";
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [pushNotifs, setPushNotifs] = useState(() => readBool(KEYS.pushNotifs));
  const [emailUpdates, setEmailUpdates] = useState(() => readBool(KEYS.emailUpdates));
  const [msgAlerts, setMsgAlerts] = useState(() => readBool(KEYS.msgAlerts));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.pushNotifs)   setPushNotifs(e.newValue !== "0");
      if (e.key === KEYS.emailUpdates) setEmailUpdates(e.newValue !== "0");
      if (e.key === KEYS.msgAlerts)    setMsgAlerts(e.newValue !== "0");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    localStorage.setItem(KEYS[key], value ? "1" : "0");
    if (key === "pushNotifs")   setPushNotifs(value as boolean);
    if (key === "emailUpdates") setEmailUpdates(value as boolean);
    if (key === "msgAlerts")    setMsgAlerts(value as boolean);
  };

  return (
    <SettingsContext.Provider value={{ pushNotifs, emailUpdates, msgAlerts, setSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
