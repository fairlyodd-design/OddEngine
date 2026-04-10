type ReleaseFn = () => void;

const lockMap = new WeakMap<HTMLElement, { owner: string }>();

export function acquireInteractionLock(root: HTMLElement, owner: string): ReleaseFn | null {
  const current = lockMap.get(root);
  if (current && current.owner !== owner) return null;
  lockMap.set(root, { owner });
  root.dataset.godInteractionBusy = "1";
  root.dataset.godInteractionOwner = owner;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const latest = lockMap.get(root);
    if (!latest || latest.owner === owner) {
      lockMap.delete(root);
      root.dataset.godInteractionBusy = "0";
      delete root.dataset.godInteractionOwner;
    }
  };
}

export function releaseInteractionLock(root: HTMLElement, owner?: string) {
  const latest = lockMap.get(root);
  if (!latest) return;
  if (owner && latest.owner !== owner) return;
  lockMap.delete(root);
  root.dataset.godInteractionBusy = "0";
  delete root.dataset.godInteractionOwner;
}

export function clearInteractionLocks(root: HTMLElement) {
  releaseInteractionLock(root);
}
