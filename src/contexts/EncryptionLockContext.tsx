import { createContext, useContext, useState, useCallback } from "react";
import { isEncryptionLocked } from "@/lib/crypto";

interface EncryptionLockContextValue {
  locked: boolean;
  reloadKey: number;
  refresh: () => void;
}

const EncryptionLockContext = createContext<EncryptionLockContextValue>({
  locked: false,
  reloadKey: 0,
  refresh: () => {},
});

export function EncryptionLockProvider({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => isEncryptionLocked());
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setLocked((prev) => {
      const next = isEncryptionLocked();
      if (prev && !next) {
        // Key just entered — bump counter so pages re-fetch
        setReloadKey((k) => k + 1);
      }
      return next;
    });
  }, []);

  return (
    <EncryptionLockContext.Provider value={{ locked, reloadKey, refresh }}>
      {children}
    </EncryptionLockContext.Provider>
  );
}

export const useEncryptionLock = () => useContext(EncryptionLockContext);
