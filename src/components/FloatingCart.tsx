"use client";

import { useRef, useState, useEffect } from "react";
import { useCart } from "@/components/CartContext";

const STORAGE_KEY = "kisi-cart-btn-pos";
const BTN_SIZE = 64;

export default function FloatingCart() {
  const { count, openCart } = useCart();

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasMoved = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Position initiale : bas gauche, au-dessus de la BottomNav
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPos(JSON.parse(saved));
      } else {
        setPos({ x: 16, y: window.innerHeight - 200 });
      }
    } catch {
      setPos({ x: 16, y: window.innerHeight - 200 });
    }
  }, []);

  // Apparaît dès qu'il y a au moins 1 article
  useEffect(() => {
    setVisible(count > 0);
  }, [count]);

  function savePos(newPos: { x: number; y: number }) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos)); } catch {}
  }

  function clamp(x: number, y: number) {
    const margin = 8;
    return {
      x: Math.min(Math.max(margin, x), window.innerWidth - BTN_SIZE - margin),
      y: Math.min(Math.max(margin, y), window.innerHeight - BTN_SIZE - margin),
    };
  }

  function snapToEdge(x: number, y: number) {
    const margin = 8;
    const isLeft = x + BTN_SIZE / 2 < window.innerWidth / 2;
    const snappedX = isLeft ? margin : window.innerWidth - BTN_SIZE - margin;
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

  function handleClick() {
    if (hasMoved.current) return;
    openCart();
  }

  if (!visible) return null;

  return (
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
        width: BTN_SIZE,
        height: BTN_SIZE,
        touchAction: "none",
        zIndex: 9998,
        transition: dragging ? "none" : "left 0.25s ease, top 0.25s ease",
      }}
      className="rounded-full shadow-2xl flex items-center justify-center select-none active:scale-95 transition-transform"

    >
      <div
        style={{
          width: BTN_SIZE,
          height: BTN_SIZE,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #00572D, #1a7a3f)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          boxShadow: "0 8px 32px rgba(0,87,45,0.4)",
        }}
      >
        <span style={{ fontSize: "26px" }}>🛒</span>

        {/* Badge compteur */}
        <div style={{
          position: "absolute",
          top: "-4px",
          right: "-4px",
          background: "#ef4444",
          color: "white",
          borderRadius: "50%",
          width: "22px",
          height: "22px",
          fontSize: "11px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid white",
        }}>
          {count}
        </div>
      </div>
    </button>
  );
}