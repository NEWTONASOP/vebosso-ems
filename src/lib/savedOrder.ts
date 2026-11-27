// ============================================================================
// VEBOSSO EMS — Saved orders (owner)
// An order the owner has arranged by hand — the bottom bar, the people in a
// department — kept on this device. Everyone reading the same key sees a change
// at once (the tab bar updates as soon as Settings saves).
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const cache = new Map<string, string[] | null>();
const listeners = new Map<string, Set<(order: string[] | null) => void>>();

async function read(key: string): Promise<string[] | null> {
  try {
    const raw =
      Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
    const list = raw ? JSON.parse(raw) : null;
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

async function write(key: string, order: string[] | null) {
  try {
    if (Platform.OS === 'web') {
      if (order) globalThis.localStorage?.setItem(key, JSON.stringify(order));
      else globalThis.localStorage?.removeItem(key);
    } else if (order) {
      await SecureStore.setItemAsync(key, JSON.stringify(order));
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Not saved: it still applies until the app closes.
  }
}

/** Save an order (null goes back to the default) and tell everyone showing it. */
export function saveOrder(key: string, order: string[] | null) {
  cache.set(key, order);
  listeners.get(key)?.forEach((l) => l(order));
  void write(key, order);
}

/** The saved order for `key`, or null when none (or not loaded yet). */
export function useSavedOrder(key: string | null): string[] | null {
  const [order, setOrder] = useState<string[] | null>(() => (key ? cache.get(key) ?? null : null));
  useEffect(() => {
    if (!key) return;
    setOrder(cache.get(key) ?? null);
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(setOrder);
    if (!cache.has(key)) {
      read(key).then((o) => {
        if (cache.has(key)) return; // Saved meanwhile.
        cache.set(key, o);
        listeners.get(key)?.forEach((l) => l(o));
      });
    }
    return () => {
      set.delete(setOrder);
    };
  }, [key]);
  return order;
}

/**
 * `items` in the saved order. Anything not in it (new since) keeps its place
 * relative to the others, after the arranged ones.
 */
export function applyOrder<T>(items: T[], order: string[] | null, id: (item: T) => string): T[] {
  if (!order?.length) return items;
  const rank = new Map(order.map((k, i) => [k, i]));
  return items
    .map((item, i) => ({ item, i, r: rank.get(id(item)) }))
    .sort((a, b) => (a.r ?? Infinity) - (b.r ?? Infinity) || a.i - b.i)
    .map((x) => x.item);
}

export const TAB_ORDER_KEY = 'owner_tab_order';
export const departmentOrderKey = (departmentId: string) => `dept_order_${departmentId}`;
