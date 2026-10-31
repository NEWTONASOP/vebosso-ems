// ============================================================================
// VEBOSSO EMS — How much of the bottom the floating tab bar covers
// CustomTabBar measures itself and writes it here (0 when it is hidden, or a
// sidebar on wide web). Screens with buttons pinned to the bottom read it so
// they sit just above the bar instead of a guessed gap.
// ============================================================================

import { create } from 'zustand';

interface TabBarState {
  /** Pixels from the bottom of the screen to the top of the bar; 0 if none. */
  space: number;
  setSpace: (space: number) => void;
}

export const useTabBarStore = create<TabBarState>((set) => ({
  space: 0,
  setSpace: (space) => set((s) => (s.space === space ? s : { space })),
}));
