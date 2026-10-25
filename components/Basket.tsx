"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// A simple basket kept in this browser (localStorage), shared across pages via a custom event.
export interface BasketLine { itemId: string; qty: number }
const KEY = "treun-basket";
const EVT = "treun-basket-change";

function read(): BasketLine[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(lines: BasketLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

export function useBasket() {
  const [lines, setLines] = useState<BasketLine[]>([]);
  useEffect(() => {
    const sync = () => setLines(read());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const add = useCallback((itemId: string, qty = 1) => {
    const cur = read();
    const hit = cur.find((l) => l.itemId === itemId);
    if (hit) hit.qty = Math.min(1000, hit.qty + qty);
    else cur.push({ itemId, qty });
    write(cur);
  }, []);
  const setQty = useCallback((itemId: string, qty: number) => {
    write(read().map((l) => (l.itemId === itemId ? { ...l, qty: Math.max(1, Math.min(1000, Math.floor(qty) || 1)) } : l)));
  }, []);
  const remove = useCallback((itemId: string) => write(read().filter((l) => l.itemId !== itemId)), []);
  const clear = useCallback(() => write([]), []);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  return { lines, add, setQty, remove, clear, count };
}

/** Basket icon with item count, for the header. */
export function BasketButton() {
  const { count } = useBasket();
  return (
    <Link href="/basket" className="basket-btn" aria-label={`Basket, ${count} item${count === 1 ? "" : "s"}`}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 9h14l-1.5 10.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </svg>
      {count > 0 && <span className="basket-count">{count}</span>}
    </Link>
  );
}

/** "Add to basket" button with a brief confirmation. */
export function AddToBasket({ itemId, qty = 1, className = "basket-add" }: { itemId: string; qty?: number; className?: string }) {
  const { add } = useBasket();
  const [done, setDone] = useState(false);
  return (
    <button
      className={className}
      onClick={() => {
        add(itemId, qty);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? "✓ Added" : "Add to basket"}
    </button>
  );
}
