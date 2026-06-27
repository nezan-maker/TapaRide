import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

let scriptLoaded = false;

export default function GoogleSignInButton({ onSuccess, onError, disabled }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const loadScript = () => {
      if (scriptLoaded || window.google) {
        initializeGoogle();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        scriptLoaded = true;
        initializeGoogle();
      };
      script.onerror = () => onError?.("Failed to load Google Sign-In");
      document.head.appendChild(script);
    };

    const initializeGoogle = () => {
      if (!window.google || !buttonRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response.credential) {
              onSuccess(response.credential);
            } else {
              onError?.("No credential received from Google");
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
        });

        setIsReady(true);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Failed to initialize Google Sign-In");
      }
    };

    loadScript();

    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [clientId, onSuccess, onError]);

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        className="btn-outline flex items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-50 w-full"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Google Sign-In not configured
      </button>
    );
  }

  return (
    <div className="w-full">
      <div ref={buttonRef} className={disabled ? "opacity-50 pointer-events-none" : ""} />
      {!isReady && (
        <div className="btn-outline flex items-center justify-center gap-2 py-3 text-sm font-semibold w-full animate-pulse">
          Loading Google Sign-In...
        </div>
      )}
    </div>
  );
}