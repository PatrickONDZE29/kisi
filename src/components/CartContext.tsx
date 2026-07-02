"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import CartModal from "@/components/CartModal";

export interface CartItem {
  id: string;
  medicine_id: string;
  medicine_name: string;
  pharmacy_id: string;
  pharmacy_name: string;
  price: number;
  quantity_available: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;
  count: number;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      if (prev.find((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
    // ✅ PAS de setShowCart(true) ici
    // Le bouton flottant apparaît grâce au count > 0
    // Le modal s'ouvre UNIQUEMENT au clic sur le bouton flottant
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((id: string) => {
    return items.some((i) => i.id === id);
  }, [items]);

  const openCart = useCallback(() => setShowCart(true), []);
  const closeCart = useCallback(() => setShowCart(false), []);

  return (
    <CartContext.Provider value={{
      items, addItem, removeItem, clearCart,
      isInCart, count: items.length,
      openCart, closeCart,
    }}>
      {children}
      {/* CartModal global — s'ouvre UNIQUEMENT via openCart() au clic sur le bouton flottant */}
      {showCart && <CartModal onClose={closeCart} />}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}