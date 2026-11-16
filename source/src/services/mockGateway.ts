// In-memory simulation only. No company endpoint or device connection.
// Timers are cancelled on phase changes / reset; reducer also rejects stale session results.
export const timings = {
  prepare: 1500,
  acknowledge: 1200,
  step: 500,
  progressPerStep: 2.5,
};
export function prepareRoute(
  shouldFail: boolean,
  done: (ok: boolean) => void,
): () => void {
  const id = window.setTimeout(() => done(!shouldFail), timings.prepare);
  return () => window.clearTimeout(id);
}
export function dispatchTask(done: () => void): () => void {
  const id = window.setTimeout(done, timings.acknowledge);
  return () => window.clearTimeout(id);
}
