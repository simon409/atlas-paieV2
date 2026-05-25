import type { PayrollState } from "../engine/state.ts";

export function traceStep(state: PayrollState, message: string): PayrollState {
  return {
    ...state,
    trace: [...state.trace, message],
  };
}
