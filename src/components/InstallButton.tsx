"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "kisi-install-btn-pos";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const hasMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const BTN_WIDTH = 160;
  const BTN_HEIGHT = 52;

  // 🔥 INSTALL PROMPT HANDLING (FIX IMPORTANT)
  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    if (isIOS()) {
      setPlatform("ios");
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();

      const event = e as BeforeInstallPromptEvent;

      setDeferredPrompt(event);
      setPlatform("android");
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // 📍 POSITION
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPos(JSON.parse(saved));
        return;
      } catch {}
    }
    setPos({
      x: window.innerWidth - BTN_WIDTH - 16,
      y: window.innerHeight - 200,
    });
  }, []);

  function savePos(newPos: { x: number; y: number }) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos));
  }

  function clamp(x: number, y: number) {
    const margin = 8;
    const maxX = window.innerWidth - BTN_WIDTH - margin;
    const maxY = window.innerHeight - BTN_HEIGHT - margin;

    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  }

  function snapToEdge(x: number, y: number) {
    const margin = 8;
    const screenWidth = window.innerWidth;

    const isLeft = x + BTN_WIDTH / 2 < screenWidth / 2;
    const snappedX = isLeft
      ? margin
      : screenWidth - BTN_WIDTH - margin;

    return clamp(snappedX, y);
  }

  function handlePointerDown(e: React.PointerEvent) {
    hasMoved.current = false;
    setDragging(true);

    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };

    btnRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved.current = true;

    setPos(clamp(dragStart.current.posX + dx, dragStart.current.posY + dy));
  }

  function handlePointerUp() {
    if (!dragging) return;

    setDragging(false);

    const finalPos = snapToEdge(pos.x, pos.y);
    setPos(finalPos);
    savePos(finalPos);
  }

  // 🚀 INSTALL CLICK (FIX IMPORTANT)
  async function handleClick() {
    if (hasMoved.current) return;

    if (platform === "ios") {
      setShowIOSModal(true);
      return;
    }

    if (platform === "android" && deferredPrompt) {
      await deferredPrompt.prompt();

      const result = await deferredPrompt.userChoice;

      if (result.outcome === "accepted") {
        setIsInstalled(true);
      }

      setDeferredPrompt(null);
    }
  }

  if (isInstalled || !platform) return null;

  return (
    <>
      <button
        ref={btnRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: BTN_WIDTH,
          height: BTN_HEIGHT,
          touchAction: "none",
          zIndex: 9999,
          transition: dragging ? "none" : "left 0.25s ease, top 0.25s ease",
          background: "linear-gradient(135deg, #4A6FA5, #64748B)",
        }}
        className="rounded-full shadow-2xl flex items-center justify-center gap-2 select-none active:scale-95 px-4"
      >
        <img src="/icon-192.png" className="w-7 h-7 rounded-full" />
        <span className="text-white font-bold text-sm">
          Installer
        </span>
      </button>

      {/* IOS MODAL */}
      {showIOSModal && platform === "ios" && (
        <div
          className="fixed inset-0 bg-black/60 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-center text-[#00572D]">
              Installer KISI
            </h2>

            <p className="text-sm mt-4 text-gray-600 text-center">
              Ajoute l'application depuis Safari → Partager → Écran d'accueil
            </p>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-6 bg-[#00572D] text-white py-3 rounded-2xl"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}