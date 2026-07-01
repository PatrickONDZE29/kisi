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

  // ----- Détection plateforme + installabilité -----
  useEffect(() => {
    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    if (isIOS()) {
      // iOS : toujours afficher le bouton -> ouvre les instructions au clic
      setPlatform("ios");
      return;
    }

    // Android/Chrome : le bouton n'apparaît QUE si Chrome a réellement
    // proposé l'installation (vrai prompt natif disponible)
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // ----- Position initiale -----
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
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
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

  // ----- Clic : comportement STRICTEMENT différent selon plateforme -----
  async function handleClick() {
    if (hasMoved.current) return;

    if (platform === "ios") {
      // iOS uniquement -> instructions manuelles
      setShowIOSModal(true);
      return;
    }

    if (platform === "android" && deferredPrompt) {
      // Android -> installation directe via le prompt natif Chrome
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setDeferredPrompt(null);
    }
    // Si Android sans deferredPrompt disponible : ne rien faire
    // (Chrome n'a pas encore jugé l'app installable, pas de fallback ici)
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
        className="rounded-full shadow-2xl flex items-center justify-center gap-2 select-none active:scale-95 transition-transform px-4"
      >
        <img src="/icon-192.png" alt="KISI" className="w-7 h-7 rounded-full pointer-events-none flex-shrink-0" />
        <span className="text-white font-bold text-sm pointer-events-none whitespace-nowrap">
          Installer
        </span>
      </button>

      {/* MODALE INSTRUCTIONS — iOS UNIQUEMENT */}
      {showIOSModal && platform === "ios" && (
        <div
          className="fixed inset-0 bg-black/60 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <img src="/icon-192.png" alt="KISI" className="w-16 h-16 mx-auto rounded-2xl mb-3" />
              <h2 className="text-xl font-bold text-[#00572D] dark:text-green-400">
                Installer KISI
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                <span className="text-2xl flex-shrink-0">1️⃣</span>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Appuyez sur le bouton <strong>Partager</strong> ⬆️ en bas de Safari
                </p>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                <span className="text-2xl flex-shrink-0">2️⃣</span>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Sélectionnez <strong>Sur l'écran d'accueil</strong>
                </p>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                <span className="text-2xl flex-shrink-0">3️⃣</span>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  Appuyez sur <strong>Ajouter</strong> en haut à droite
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-6 bg-[#00572D] dark:bg-green-700 text-white py-3 rounded-2xl font-bold hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}