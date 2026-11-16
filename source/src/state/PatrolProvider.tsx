import { useEffect, useReducer, useRef, type ReactNode } from "react";
import { initialState, reducer } from "../domain/model";
import { prepareRoute, dispatchTask, timings } from "../services/mockGateway";
import { PatrolContext } from "./PatrolContext";
export function PatrolProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(),
  );
  const { phase, session, plan, faultNext } = state;
  const progressRef = useRef(state.progress);
  progressRef.current = state.progress;
  const revision = plan?.revision;
  useEffect(() => {
    if ((phase === "preparing" || phase === "retrying") && revision)
      return prepareRoute(faultNext, (ok) =>
        dispatch({ type: "PREPARED", session, revision, ok }),
      );
    if (phase === "dispatching" && revision)
      return dispatchTask(() => dispatch({ type: "ACK", session, revision }));
  }, [phase, session, revision, faultNext]);
  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      dispatch({
        type: "PROGRESS",
        session,
        progress: progressRef.current + timings.progressPerStep,
      });
    }, timings.step);
    return () => window.clearInterval(id);
  }, [phase, session]);
  useEffect(() => {
    const id = window.setInterval(
      () => dispatch({ type: "TICK", now: Date.now() }),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  return (
    <PatrolContext.Provider value={{ state, dispatch }}>
      {children}
    </PatrolContext.Provider>
  );
}
