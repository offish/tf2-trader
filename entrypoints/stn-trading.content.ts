export default defineContentScript({
  matches: ["*://*.stntrading.eu/*"],
  runAt: "document_idle",
  main() {
    let firstSelected: HTMLElement | null = null;

    const getInventoryItems = (): HTMLElement[] => {
      return Array.from(
        document.querySelectorAll<HTMLElement>(".inventoryItem"),
      );
    };

    const triggerItemClick = (item: HTMLElement): void => {
      item.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
          shiftKey: false,
        }),
      );
    };

    const selectRange = (start: HTMLElement, end: HTMLElement): void => {
      const items = getInventoryItems();
      const startIdx = items.indexOf(start);
      const endIdx = items.indexOf(end);

      if (startIdx === -1 || endIdx === -1) return;

      const [min, max] =
        startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];

      const goalActive =
        start.classList.contains("active") ||
        start.classList.contains("selected");

      for (let i = min; i <= max; i++) {
        const item = items[i];
        const isCurrentlyActive =
          item.classList.contains("active") ||
          item.classList.contains("selected");

        if (isCurrentlyActive !== goalActive) {
          triggerItemClick(item);
        }
      }
    };

    document.addEventListener(
      "click",
      (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const item = target.closest<HTMLElement>(".inventoryItem");

        if (!item || e.button !== 0) return;

        if (e.shiftKey && firstSelected && firstSelected !== item) {
          e.preventDefault();
          e.stopImmediatePropagation();

          selectRange(firstSelected, item);
        } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setTimeout(() => {
            firstSelected = item;
          }, 10);
        }
      },
      { capture: false },
    );
  },
});
