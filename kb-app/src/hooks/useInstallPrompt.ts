import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function handleAppInstalled() {
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function promptInstall() {
    const prompt = deferredPrompt;
    if (!prompt) return;
    // Clear synchronously, before awaiting — a captured beforeinstallprompt
    // event can only be prompted once, so the button must not offer a
    // second click while this one's dialog is still open.
    setDeferredPrompt(null);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // The browser refused the prompt (e.g. already consumed) — nothing to
      // recover; the event is spent either way.
    }
  }

  return { canInstall: deferredPrompt !== null, promptInstall };
}
