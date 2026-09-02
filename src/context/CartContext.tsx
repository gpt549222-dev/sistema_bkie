import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CartItem, Product, Offer } from '../types';
import { calculateProductPrice } from '../services/pricingEngine';
import { getOffers } from '../services/offerService';
import { useRealtime } from './RealtimeContext';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  itemCount: number;
  offers: Offer[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const { refreshTrigger } = useRealtime();

  // Load active offers
  useEffect(() => {
    getOffers()
      .then((data) => setOffers(data))
      .catch((err) => console.warn('Could not load offers for cart:', err));
  }, [refreshTrigger]);

  // Recalculate prices whenever offers change
  useEffect(() => {
    if (items.length === 0) return;
    setItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        calculation: calculateProductPrice(item.product, offers, item.quantity),
      }))
    );
  }, [offers]);

  const addItem = (product: Product, quantity = 1) => {
    if (product.stock <= 0) {
      alert(`El producto "${product.name}" está agotado.`);
      return;
    }

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((i) => i.product.id === product.id);
      const calc = calculateProductPrice(product, offers, quantity);

      if (existingIndex > -1) {
        const currentQty = prevItems[existingIndex].quantity;
        const newQty = Math.min(product.stock, currentQty + quantity);
        if (newQty === currentQty) {
          alert(`No puedes agregar más unidades. El stock máximo disponible es ${product.stock}.`);
          return prevItems;
        }
        const updated = [...prevItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
          calculation: calculateProductPrice(product, offers, newQty),
        };
        return updated;
      }

      const safeQty = Math.min(product.stock, quantity);
      return [...prevItems, { product, quantity: safeQty, calculation: calc }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.product.id === productId) {
          const safeQty = Math.min(item.product.stock, quantity);
          if (quantity > item.product.stock) {
            alert(`Stock máximo alcanzado (${item.product.stock} unidades).`);
          }
          return {
            ...item,
            quantity: safeQty,
            calculation: calculateProductPrice(item.product, offers, safeQty),
          };
        }
        return item;
      })
    );
  };

  const removeItem = (productId: string) => {
    setItems((prevItems) => prevItems.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const { subtotal, discount, tax, total, itemCount } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    let count = 0;

    for (const item of items) {
      const originalSub = item.calculation.originalPrice * item.quantity;
      const finalSub = item.calculation.finalPrice * item.quantity;
      sub += originalSub;
      disc += (originalSub - finalSub);
      count += item.quantity;
    }

    const discountedTotal = Math.max(0, sub - disc);
    const calculatedTax = 0; // Prices in stationery are listed final/exempt or calculated
    const grandTotal = discountedTotal + calculatedTax;

    return {
      subtotal: sub,
      discount: disc,
      tax: calculatedTax,
      total: grandTotal,
      itemCount: count,
    };
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        subtotal,
        discount,
        tax,
        total,
        itemCount,
        offers,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser utilizado dentro de un CartProvider');
  }
  return context;
}
