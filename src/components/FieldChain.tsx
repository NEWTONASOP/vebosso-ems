// ============================================================================
// VEBOSSO EMS — Enter / Next moves to the next box, everywhere
// Every text box (SmoothTextInput, so also PaperOutlinedField) joins the
// nearest FieldChainScope. When a single-line box has no Enter handler of its
// own, its Enter / Next key moves to the box that comes next on screen — below
// it, or to its right on the same line — measured at that moment, so boxes
// added or hidden later (a new family member, an "Other" field) still go in
// the right order. With nothing after it, the keyboard closes.
//
// Each sheet (SheetFrame) is its own scope, so a sheet never jumps into the
// screen behind it. The root layout holds the scope for full screens.
// ============================================================================

import { createContext, ReactNode, useContext, useMemo, useRef } from 'react';
import { Keyboard, TextInput } from 'react-native';

/**
 * `input` is read when needed: a box can swap its inner TextInput (a reset).
 * `active`: false while its screen isn't the one in front (a tab or a screen
 * further back in the stack), so Next never jumps there.
 */
type Entry = { input: () => TextInput | null; editable: boolean; active: () => boolean };

interface Chain {
  register: (id: number, entry: Entry | null) => void;
  next: (fromId: number) => void;
}

const FieldChainContext = createContext<Chain | null>(null);

let lastId = 0;
export const newFieldId = () => ++lastId;

type Box = { id: number; input: TextInput; x: number; y: number; w: number; h: number };

const measure = (id: number, input: TextInput | null) =>
  new Promise<Box | null>((resolve) => {
    if (!input) return resolve(null);
    try {
      input.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { id, input, x, y, w, h } : null));
    } catch {
      resolve(null);
    }
  });

export function FieldChainScope({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<number, Entry>());

  const chain = useMemo<Chain>(
    () => ({
      register: (id, entry) => {
        if (entry) entries.current.set(id, entry);
        else entries.current.delete(id);
      },
      next: async (fromId) => {
        const from = entries.current.get(fromId);
        if (!from) return Keyboard.dismiss();
        const boxes = (
          await Promise.all(
            [...entries.current.entries()]
              .filter(([id, e]) => id === fromId || (e.editable && e.active()))
              .map(([id, e]) => measure(id, e.input())),
          )
        ).filter((b): b is Box => !!b);
        const me = boxes.find((b) => b.id === fromId);
        if (!me) return Keyboard.dismiss();
        // Same line = vertical centres within half a box of each other.
        const sameLine = (b: Box) => Math.abs(b.y + b.h / 2 - (me.y + me.h / 2)) < me.h / 2;
        const after = boxes
          .filter((b) => b.id !== fromId && (sameLine(b) ? b.x > me.x : b.y > me.y))
          .sort((a, b) => (sameLine(a) && sameLine(b) ? a.x - b.x : sameLine(a) ? -1 : sameLine(b) ? 1 : a.y - b.y || a.x - b.x));
        if (after[0]) after[0].input.focus();
        else Keyboard.dismiss();
      },
    }),
    [],
  );

  return <FieldChainContext.Provider value={chain}>{children}</FieldChainContext.Provider>;
}

export const useFieldChainScope = () => useContext(FieldChainContext);
