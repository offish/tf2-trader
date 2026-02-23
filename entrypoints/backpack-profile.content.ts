import { parseItem, getKeysListedValue, refinedToKeys } from "@/utils/backpack";

export default defineContentScript({
  matches: ["*://backpack.tf/id/*", "*://backpack.tf/profiles/*"],
  async main() {
    const STORAGE_KEY = "getInventory.key_price";
    let keyValue: number =
      (await storage.getItem<number>(`local:${STORAGE_KEY}`)) ?? 0;

    const getRefinedEl = () =>
      document.querySelector(".refined-value") as HTMLElement;
    const getBackpackEl = () => document.getElementById("backpack");
    const getSortMenu = () =>
      document.querySelector("#inventory-sort-menu ul.dropdown-menu");

    const updateInventoryTotals = () => {
      const refinedEl = getRefinedEl();
      if (!keyValue || !refinedEl) return;

      const refinedText =
        refinedEl.textContent?.replace(/,/g, "").trim() || "0";
      const refinedValue = parseFloat(refinedText);
      if (isNaN(refinedValue)) return;

      const keysValue = refinedToKeys(refinedValue, keyValue);

      mainObserver.disconnect();
      refObserver.disconnect();

      refinedEl.textContent = keysValue.toString();

      // Restart observers
      observeRefChanges();
      const bp = getBackpackEl();
      if (bp) mainObserver.observe(bp, observerSettings);
    };

    const onBackpackLoad = async () => {
      const backpack = getBackpackEl();
      if (!backpack) return;

      const itemInKeys = backpack.querySelector(
        'li.item[data-p_bptf*="keys"]',
      ) as HTMLElement;
      const crateKey = backpack.querySelector(
        '.item[data-name="Mann Co. Supply Crate Key"]',
      ) as HTMLElement;

      let bpKeyValue: number | undefined;

      if (itemInKeys) {
        const price = parseItem(itemInKeys);
        if (price.currency === "keys" && price.average && price.refined) {
          bpKeyValue = price.refined / price.average;
        }
      } else if (crateKey) {
        const price = parseItem(crateKey);
        bpKeyValue = price.refined;
      }

      if (bpKeyValue) {
        keyValue = bpKeyValue;
        await storage.setItem(`local:${STORAGE_KEY}`, keyValue);
      }

      const label = getRefinedEl()?.closest("li")?.querySelector("small");
      if (label) label.textContent = "keys";

      updateInventoryTotals();
    };

    const refObserver = new MutationObserver(updateInventoryTotals);
    const observeRefChanges = () => {
      const el = getRefinedEl();
      if (el) refObserver.observe(el, { childList: true });
    };

    const observerSettings = { childList: true, subtree: true };
    const mainObserver = new MutationObserver((mutations) => {
      const hasItemList = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (node) => (node as HTMLElement).className === "item-list",
        ),
      );
      if (hasItemList) onBackpackLoad();
    });

    const backpack = getBackpackEl();
    if (backpack) mainObserver.observe(backpack, observerSettings);

    document.addEventListener("mouseover", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("refined-value") && keyValue) {
        const listedItems = Array.from(
          document.querySelectorAll(
            "li.item:visible:not(.unselected)[data-listing_price]",
          ),
        ) as HTMLElement[];
        const listedKeys = getKeysListedValue(listedItems, keyValue);
        target.setAttribute("title", `${listedKeys} keys listed value`);
      }
    });

    window.addEventListener("keypress", (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || ""))
        return;

      const key = e.key.toLowerCase();
      if (key === "p") {
        const selected = Array.from(
          document.querySelectorAll(
            "#backpack li.item:visible:not(.unselected)",
          ),
        ) as HTMLElement[];
        const ids = selected
          .map((el) => el.dataset.id)
          .filter(Boolean)
          .join(",");
        navigator.clipboard.writeText(ids);
      } else if (["1", "2", "3"].includes(key)) {
        const sortMap: Record<string, string> = {
          "1": "bpslot",
          "2": "price",
          "3": "market",
        };
        const sortBtn = getSortMenu()?.querySelector(
          `li[data-value="${sortMap[key]}"]`,
        ) as HTMLElement;
        sortBtn?.click();
      }
    });
  },
});
