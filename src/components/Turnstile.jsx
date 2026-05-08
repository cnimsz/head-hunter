import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '';

export default function Turnstile({ onToken, onExpire, onError, theme = 'auto' }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!SITE_KEY) {
      console.error('VITE_TURNSTILE_SITE_KEY is not set; Turnstile will not render.');
      return;
    }
    let cancelled = false;
    let pollHandle = null;

    function render() {
      if (cancelled || !containerRef.current || widgetIdRef.current != null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme,
        callback: (token) => onTokenRef.current?.(token),
        'expired-callback': () => onExpireRef.current?.(),
        'error-callback': () => onErrorRef.current?.()
      });
    }

    if (window.turnstile?.render) {
      render();
    } else {
      pollHandle = setInterval(() => {
        if (window.turnstile?.render) {
          clearInterval(pollHandle);
          pollHandle = null;
          render();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollHandle) clearInterval(pollHandle);
      if (widgetIdRef.current != null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [theme]);

  return <div ref={containerRef} className="cf-turnstile" />;
}

export function resetTurnstile() {
  if (typeof window !== 'undefined' && window.turnstile?.reset) {
    window.turnstile.reset();
  }
}
