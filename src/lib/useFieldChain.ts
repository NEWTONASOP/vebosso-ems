// ============================================================================
// VEBOSSO EMS — Keyboard "Next" between fields
// Register text inputs by name, then point each one's Next key at the next
// name. Used by the longer forms (bills, venues, expenses, account entries).
//
//   const chain = useFieldChain();
//   <TextInput ref={chain.reg('name')} returnKeyType="next"
//              onSubmitEditing={chain.next('phone')} />
// ============================================================================

import { useMemo, useRef } from 'react';
import { TextInput } from 'react-native';

export function useFieldChain() {
  const inputs = useRef<Record<string, TextInput | null>>({});

  return useMemo(
    () => ({
      /** Ref callback that records the input under `key`. */
      reg: (key: string) => (el: TextInput | null) => {
        inputs.current[key] = el;
      },
      /** Handler that moves focus to the input registered as `key`. */
      next: (key: string) => () => {
        inputs.current[key]?.focus();
      },
    }),
    []
  );
}
