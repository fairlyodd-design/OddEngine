import { useEffect } from "react";

// Passive visual cleanup mode.
// We keep the hook in place so existing App wiring does not change,
// but we stop injecting shrink / move / pin controls and instead
// normalize cards so they stay in-flow and fit the available width.
export default function CardGODMode({ panelId }: { panelId: string }) {
  useEffect(() => {
    const root = document.querySelector(`.panelMain[data-panelid="${panelId}"]`) as HTMLElement | null;
    if (!root) return;

    const normalize = () => {
      root.classList.remove("godGridOn", "godLocked");
      root.querySelectorAll(".godLayoutBar").forEach((el) => el.remove());
      root.querySelectorAll(".godCardControls").forEach((el) => el.remove());

      const cards = Array.from(root.querySelectorAll<HTMLElement>(".card"))
        .filter((c) => !c.closest(".rail") && !c.closest(".activityRail"));

      cards.forEach((card) => {
        card.classList.remove("godCollapsed", "godFloating", "godPinned");
        delete card.dataset.godCollapsed;
        delete card.dataset.godFloating;
        delete card.dataset.godPinned;
        delete card.dataset.godAttached;

        card.style.position = "relative";
        card.style.left = "";
        card.style.top = "";
        card.style.width = "100%";
        card.style.maxWidth = "100%";
        card.style.height = "";
        card.style.zIndex = "";
        card.style.resize = "none";
        card.style.overflow = "visible";
        card.style.minWidth = "0";

        const headerLike =
          (card.querySelector(".h") as HTMLElement | null) ||
          (card.querySelector("h1,h2,h3") as HTMLElement | null) ||
          (card.querySelector("[data-title]") as HTMLElement | null);
        if (headerLike) {
          headerLike.style.cursor = "";
          headerLike.removeAttribute("title");
          delete headerLike.dataset.godBound;
        }
      });
    };

    normalize();
    const mo = new MutationObserver(() => normalize());
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [panelId]);

  return null;
}
