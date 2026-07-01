"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const styles = {
    success: { bg: "bg-[#00572D]", icon: "✅" },
    error:   { bg: "bg-red-600",   icon: "❌" },
    info:    { bg: "bg-blue-600",  icon: "ℹ️" },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-sm animate-slide-down">
          <div className={`${styles[toast.type].bg} text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4`}>
            <span className="text-2xl flex-shrink-0">{styles[toast.type].icon}</span>
            <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="flex-shrink-0 text-white/70 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}