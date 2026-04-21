import { useState, useEffect, useCallback } from 'react';
import { db } from './useFirebase';
import { ref, get, child, update } from 'firebase/database';

export interface LicenseData {
  key: string;
  machineId: string;
  status: 'active' | 'used' | 'revoked';
  owner?: string;
  activatedAt?: number;
}

const STORAGE_KEY = 'gridup_license_data';

export const useLicense = () => {
  const [isValidated, setIsValidated] = useState<boolean | null>(null); // null means checking
  const [error, setError] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);

  // 1. Fetch Machine ID on mount
  useEffect(() => {
    if (window.electron && window.electron.getMachineId) {
      window.electron.getMachineId().then((id: string) => {
        setMachineId(id);
      }).catch((e: any) => {
        console.error("Failed to get machine ID:", e);
        setError("Could not identify this computer. License verification failed.");
        setIsValidated(false);
      });
    }
  }, []);

  // 2. Perform Validation
  const validateLicense = useCallback(async (localMachineId?: string) => {
    const targetMachineId = localMachineId || machineId;
    if (!targetMachineId) return;

    const storedData = localStorage.getItem(STORAGE_KEY);
    
    // OFFLINE CHECK: If we have stored data and it matches current machine, allow access
    if (storedData) {
      try {
        const parsed: LicenseData = JSON.parse(storedData);
        if (parsed.machineId === targetMachineId) {
          setIsValidated(true);
          // Don't stop here—try to re-verify online if possible to check for 'revoked' status
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // ONLINE CHECK: Verify with Firebase
    if (!db) {
      // If truly offline and we already validated via local ID, we stay true
      if (isValidated === null) setIsValidated(false);
      return;
    }

    if (storedData) {
      const parsed: LicenseData = JSON.parse(storedData);
      try {
        const licenseRef = ref(db, `license_keys/${parsed.key}`);
        const snapshot = await get(licenseRef);
        
        if (snapshot.exists()) {
          const cloudData = snapshot.val();
          
          if (cloudData.status === 'revoked') {
            setError("This license has been revoked. Please contact support.");
            setIsValidated(false);
            localStorage.removeItem(STORAGE_KEY);
            return;
          }

          if (cloudData.machineId !== targetMachineId) {
            setError("This license is registered to another computer.");
            setIsValidated(false);
            localStorage.removeItem(STORAGE_KEY);
            return;
          }

          // All good! Update local timestamp
          setIsValidated(true);
        } else {
          // Key deleted from DB
          setError("License data not found. Re-activation required.");
          setIsValidated(false);
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        // Online check failed (network issue?), trust local check if already done
        console.warn("Online license check failed, falling back to local validation.");
      }
    } else {
      // No stored data and we haven't activated yet
      setIsValidated(false);
    }
  }, [machineId, isValidated]);

  // Initial check
  useEffect(() => {
    if (machineId) {
      validateLicense();
    }
  }, [machineId, validateLicense]);

  // Activation function (called by UI)
  const activate = async (key: string): Promise<boolean> => {
    if (!db || !machineId) {
      setError("Internet connection required for initial activation.");
      return false;
    }

    setError(null);
    try {
      const licenseRef = ref(db, `license_keys/${key}`);
      const snapshot = await get(licenseRef);

      if (!snapshot.exists()) {
        setError("Invalid license key.");
        return false;
      }

      const cloudData = snapshot.val();

      if (cloudData.status === 'revoked') {
        setError("This license has been revoked.");
        return false;
      }

      // Check if key is already used by someone else
      if (cloudData.machineId && cloudData.machineId !== machineId) {
        setError("This key is already locked to another computer.");
        return false;
      }

      // ACTIVATE: Link machine ID to key
      const activationData: any = {
        status: 'used',
        machineId: machineId,
        activatedAt: Date.now()
      };

      await update(licenseRef, activationData);

      // Store locally for offline use
      const localData: LicenseData = {
        key,
        machineId,
        status: 'used',
        ...activationData
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
      setIsValidated(true);
      return true;

    } catch (e: any) {
      setError("Activation failed: " + e.message);
      return false;
    }
  };

  return { isValidated, error, activate, machineId };
};
