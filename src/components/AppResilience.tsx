'use client';

import React, { Component, ReactNode, useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, WifiOff } from 'lucide-react';
import { APP_ONLINE_EVENT, restartApp } from '../lib/reliability';

const primaryColor = '#212121';

declare global {
  interface Window {
    workbox?: {
      addEventListener: (event: string, callback: (event?: { isUpdate?: boolean }) => void) => void;
    };
  }
}

type ErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Application render failed', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-dvh place-items-center bg-gray-50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 text-center shadow-lg">
            <h1 className="text-lg font-semibold text-gray-900">The app needs a quick restart</h1>
            <p className="mt-2 text-sm text-gray-600">
              Your saved map data is kept on this device. Restart the app to recover the screen.
            </p>
            <button
              type="button"
              onClick={restartApp}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <RotateCcw size={18} />
              Restart App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function OfflineBanner() {
  // Browser online/offline events are advisory and can be incorrect on mobile
  // emulation and some network stacks. Start optimistic and use the real ping
  // endpoint as the authoritative signal for this banner.
  const [isOnline, setIsOnline] = useState(true);
  const isOnlineRef = useRef(true);
  const failedProbeCountRef = useRef(0);

  useEffect(() => {
    let checkTimer: number | null = null;
    let mounted = true;

    const markOnline = () => {
      const wasOnline = isOnlineRef.current;
      isOnlineRef.current = true;
      failedProbeCountRef.current = 0;
      // Always reconcile React state. The ref only prevents duplicate retry
      // events; using it to skip this update can leave a visible stale banner.
      if (mounted) setIsOnline(true);
      if (!wasOnline) {
        window.dispatchEvent(new Event(APP_ONLINE_EVENT));
      }
    };
    const markOffline = () => {
      isOnlineRef.current = false;
      if (mounted) setIsOnline(false);
    };

    const checkConnectivity = async () => {
      if (!mounted) return;
      
      // Verify connectivity with a same-origin, network-only request. Do not use
      // navigator.onLine as a verdict: it only reports the browser's network
      // interface state, not whether this application can reach the internet.
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);

      try {
        // The service worker has a NetworkOnly route for this endpoint.
        const response = await fetch(`/api/ping?t=${Date.now()}`, { 
          method: 'GET', 
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'pragma': 'no-cache',
            'cache-control': 'no-cache'
          }
        });

        if (response.ok) {
          markOnline();
          return;
        }
      } catch {
        // Fall through to the shared failure handling below.
      } finally {
        window.clearTimeout(timeoutId);
      }

      // Avoid showing an Offline banner for a single transient request failure.
      failedProbeCountRef.current += 1;
      if (failedProbeCountRef.current >= 2) markOffline();
    };

    // Initial check
    checkConnectivity();

    // A low-frequency probe can confirm recovery without creating background
    // traffic or repeatedly retrying searches.
    checkTimer = window.setInterval(checkConnectivity, 30_000);

    // Use browser events only to prompt an immediate authoritative check.
    // They must not directly change the banner because they can be false.
    window.addEventListener('online', checkConnectivity);
    window.addEventListener('offline', checkConnectivity);

    return () => {
      mounted = false;
      if (checkTimer) clearInterval(checkTimer);
      window.removeEventListener('online', checkConnectivity);
      window.removeEventListener('offline', checkConnectivity);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[3000] flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-sm font-medium text-white shadow-lg">
      <WifiOff size={17} />
      Offline. Saved map data still works; new map/search data will retry when connected.
    </div>
  );
}

function ServiceWorkerUpdatePrompt() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    let refreshing = false;

    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const markUpdate = () => setHasUpdate(true);
    const attachWorkboxListeners = () => {
      window.workbox?.addEventListener('waiting', markUpdate);
      window.workbox?.addEventListener('externalwaiting', markUpdate);
    };
    const checkWaitingWorker = async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration?.waiting) markUpdate();
    };

    attachWorkboxListeners();
    const listenerTimeout = window.setTimeout(attachWorkboxListeners, 1000);
    checkWaitingWorker();
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    return () => {
      window.clearTimeout(listenerTimeout);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const activateUpdate = async () => {
    const registration = await navigator.serviceWorker?.getRegistration();
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!hasUpdate) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-[3000] rounded-lg border border-blue-100 bg-white p-3 shadow-xl">
      <p className="text-sm font-semibold text-gray-900">App update ready</p>
      <p className="mt-1 text-xs text-gray-600">Reload once to use the latest offline files.</p>
      <button
        type="button"
        onClick={activateUpdate}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <RefreshCw size={16} />
        Reload Now
      </button>
    </div>
  );
}

export default function AppResilience({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      {children}
      <OfflineBanner />
      <ServiceWorkerUpdatePrompt />
    </AppErrorBoundary>
  );
}
