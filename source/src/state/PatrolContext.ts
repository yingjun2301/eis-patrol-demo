import { createContext, useContext, type Dispatch } from "react";
import type { State, Action } from "../domain/model";
// Keep context identity outside React refresh boundaries.
export const PatrolContext = createContext<{
  state: State;
  dispatch: Dispatch<Action>;
} | null>(null);
export function usePatrol() {
  const value = useContext(PatrolContext);
  if (!value) throw new Error("PatrolProvider missing");
  return value;
}
