/**
 * Safe Browser Storage Wrapper for Safari & Private Browsing Compatibility
 * 
 * In Safari (particularly Private Browsing mode or with strict privacy configurations),
 * accessing localStorage or sessionStorage can throw a `SecurityError: The operation is insecure`
 * or a `QuotaExceededError`.
 * 
 * This wrapper provides safe, non-throwing access with an automatic in-memory fallback,
 * ensuring gameplay state, guest matches, and calibration never crash the app in Safari.
 */

class SafeStorage implements Storage {
  private memoryFallback: Map<string, string> = new Map();
  private storageType: 'localStorage' | 'sessionStorage';

  constructor(type: 'localStorage' | 'sessionStorage') {
    this.storageType = type;
  }

  private getNativeStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
      const storage = window[this.storageType];
      // Test read/write probe to verify it doesn't throw SecurityError
      const testKey = '__praisetiles_probe__';
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return storage;
    } catch {
      return null;
    }
  }

  public getItem(key: string): string | null {
    try {
      const storage = this.getNativeStorage();
      if (storage) {
        return storage.getItem(key);
      }
    } catch {
      // Fall through to memory
    }
    return this.memoryFallback.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    try {
      const storage = this.getNativeStorage();
      if (storage) {
        storage.setItem(key, value);
        return;
      }
    } catch {
      // Fall through to memory
    }
    this.memoryFallback.set(key, value);
  }

  public removeItem(key: string): void {
    try {
      const storage = this.getNativeStorage();
      if (storage) {
        storage.removeItem(key);
      }
    } catch {
      // Ignore
    }
    this.memoryFallback.delete(key);
  }

  public clear(): void {
    try {
      const storage = this.getNativeStorage();
      if (storage) {
        storage.clear();
      }
    } catch {
      // Ignore
    }
    this.memoryFallback.clear();
  }

  public key(index: number): string | null {
    try {
      const storage = this.getNativeStorage();
      if (storage) {
        return storage.key(index);
      }
    } catch {
      // Fall through
    }
    const keys = Array.from(this.memoryFallback.keys());
    return keys[index] ?? null;
  }

  public get length(): number {
    try {
      const storage = this.getNativeStorage();
      if (storage) {
        return storage.length;
      }
    } catch {
      // Fall through
    }
    return this.memoryFallback.size;
  }
}

export const safeLocalStorage = new SafeStorage('localStorage');
export const safeSessionStorage = new SafeStorage('sessionStorage');
