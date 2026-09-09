import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Safely check if already running in standalone/installed mode
    let isStandalone = false;
    try {
      isStandalone =
        (typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof navigator !== 'undefined' &&
          (navigator as unknown as { standalone?: boolean }).standalone === true) ||
        (typeof document !== 'undefined' &&
          typeof document.referrer === 'string' &&
          document.referrer.includes('android-app://'));
    } catch {
      isStandalone = false;
    }

    setIsInstalled(isStandalone);

    let iosDevice = false;
    let androidDevice = false;
    try {
      const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
      iosDevice = /iphone|ipad|ipod/.test(ua);
      androidDevice = /android/.test(ua);
    } catch {
      // ignore
    }

    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (): Promise<'accepted' | 'dismissed' | 'manual_needed'> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return outcome;
    }
    return 'manual_needed';
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    triggerInstall,
  };
}
