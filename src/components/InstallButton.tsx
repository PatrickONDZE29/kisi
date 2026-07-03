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
  const [showTooltip, setShowTooltip] = useState(false);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const hasMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const BTN_WIDTH = 56;
  const BTN_HEIGHT = 56;

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

  // Affiche le tooltip au premier chargement pendant 5 secondes
  useEffect(() => {
    if (!platform || isInstalled) return;
    const shown = sessionStorage.getItem("kisi-tooltip-shown");
    if (!shown) {
      setShowTooltip(true);
      sessionStorage.setItem("kisi-tooltip-shown", "true");
      const timer = setTimeout(() => setShowTooltip(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [platform, isInstalled]);

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
    const snappedX = isLeft ? margin : screenWidth - BTN_WIDTH - margin;

    return clamp(snappedX, y);
  }

  function handlePointerDown(e: React.PointerEvent) {
    hasMoved.current = false;
    setDragging(true);
    setShowTooltip(false);

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

  // Détecte si le bouton est à gauche ou à droite
  const isOnLeft = pos.x + BTN_WIDTH / 2 < (typeof window !== "undefined" ? window.innerWidth / 2 : 200);

  return (
    <>
      {/* BOUTON ROND AVEC LOGO */}
      <div
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          zIndex: 9999,
          transition: dragging ? "none" : "left 0.25s ease, top 0.25s ease",
        }}
      >
        {/* Tooltip professionnel */}
        {showTooltip && (
          <div
            className={`absolute -top-14 ${
              isOnLeft ? "left-0" : "right-0"
            } bg-[#00572D] text-white text-[11px] px-3 py-2 rounded-xl shadow-lg whitespace-nowrap animate-bounce`}
          >
            📲 Téléchargez l&apos;appli KISI
            <div
              className={`absolute -bottom-1.5 ${
                isOnLeft ? "left-5" : "right-5"
              } w-3 h-3 bg-[#00572D] rotate-45`}
            />
          </div>
        )}

        <button
          ref={btnRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
          style={{
            width: BTN_WIDTH,
            height: BTN_HEIGHT,
            touchAction: "none",
            background: "linear-gradient(135deg, #00572D, #007A3D)",
          }}
          className="rounded-full shadow-2xl flex items-center justify-center select-none active:scale-95 border-2 border-white/30"
        >
          <img src="/icon-192.png" className="w-9 h-9 rounded-full" alt="KISI" />
        </button>
      </div>

      {/* MODAL INSTALLATION — Android & iOS */}
      {showIOSModal && platform === "ios" && (
        <div
          className="fixed inset-0 bg-black/60 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <img src="/icon-192.png" className="w-16 h-16 mx-auto rounded-2xl shadow-md" alt="KISI" />
              <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400 mt-3">
                Installer KISI
              </h2>
              <p className="text-sm mt-3 text-gray-600 dark:text-gray-300 leading-relaxed">
                Accédez à KISI directement depuis votre écran d&apos;accueil pour une expérience plus rapide et fluide.
              </p>
            </div>

            <div className="mt-5 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Comment faire :</p>
              <div className="flex items-start gap-3">
                <span className="text-lg">1️⃣</span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Appuyez sur le bouton <strong>Partager</strong> (icône ↑) en bas de Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">2️⃣</span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Faites défiler et appuyez sur <strong>« Sur l&apos;écran d&apos;accueil »</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">3️⃣</span>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Confirmez en appuyant sur <strong>Ajouter</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-5 bg-[#00572D] text-white py-3 rounded-2xl font-bold text-sm"
            >
              J&apos;ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}