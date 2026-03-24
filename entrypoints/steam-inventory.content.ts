import "@/styles/steam-inventory.css";
import { addAttributesToElement, getItemAttributes, buildSku } from "@/utils/inventory";

const injectPricedbButton = (assetId: string) => {
  const wikiLink = document.querySelector<HTMLAnchorElement>(
    'a[href*="itemredirect.php"]',
  );
  if (!wikiLink) return;

  const existing = document.getElementById("pricedb-btn");
  if (existing) {
    const currentAsset = existing.getAttribute("data-asset");
    if (currentAsset === assetId) return;
    existing.remove();
  }

  const defindex = new URL(wikiLink.href).searchParams.get("id");
  if (!defindex) return;

  const win = window as any;
  const assets =
    win.g_rgAppContextData?.[440]?.rgContexts?.[2]?.inventory?.m_rgAssets;
  if (!assets) return;

  const asset = assets[assetId];
  if (!asset) return;

  const item = getItemAttributes(asset.description);
  const sku = buildSku(defindex, item);

  const container = document.createElement("div");
  container.id = "pricedb-btn";
  container.setAttribute("data-asset", assetId);
  container.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-bottom:10px;width:100%;";

  const pricedbLink = document.createElement("a");
  pricedbLink.href = `https://pricedb.io/item/${encodeURIComponent(sku)}`;
  pricedbLink.target = "_blank";
  pricedbLink.textContent = "PriceDB.io";
  pricedbLink.style.cssText = "color:yellow;flex:1;";
  container.appendChild(pricedbLink);

  if (item.series !== undefined) {
    const sep = document.createElement("span");
    sep.textContent = "|";
    sep.style.cssText = "color:#8f98a0;padding:0 2px;";

    const crateLink = document.createElement("a");
    crateLink.href = `http://crate.tf/item/${encodeURIComponent(sku)}`;
    crateLink.target = "_blank";
    crateLink.textContent = "Crate.tf";
    crateLink.style.cssText = "color:#67C1F5;";

    container.appendChild(sep);
    container.appendChild(crateLink);
  }

  wikiLink.parentElement!.insertBefore(container, wikiLink);
};

const observeItemSelection = () => {
  const itemInfoEls = document.querySelectorAll("#iteminfo0, #iteminfo1");

  itemInfoEls.forEach((el) => {
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      const panel = el as HTMLElement;
      if (panel.style.display === "none") return;

      // debounce to avoid firing multiple times per selection
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const selectedItem =
          document.querySelector<HTMLElement>(".item.activeInfo");
        if (!selectedItem) return;

        const assetId = selectedItem.id.split("_")[2];
        if (!assetId) return;

        injectPricedbButton(assetId);
      }, 150);
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  });
};

const processInventory = () => {
  const win = window as any;
  const inventoryData =
    win.g_rgAppContextData?.[440]?.rgContexts?.[2]?.inventory;

  if (!inventoryData) return;

  const userSteamId = win.UserYou?.strSteamId;
  const tf2InvEl = document.getElementById(`inventory_${userSteamId}_440_2`);

  if (!tf2InvEl) return;

  const assets = inventoryData.m_rgAssets;
  const items = tf2InvEl.querySelectorAll(".item:not(.pendingItem)");

  items.forEach((itemEl) => {
    const assetId = itemEl.id.split("_")[2];
    const asset = assets[assetId];
    if (asset) addAttributesToElement(itemEl as HTMLElement, asset.description);
  });
};

export default defineContentScript({
  matches: [
    "*://steamcommunity.com/id/*/inventory*",
    "*://steamcommunity.com/profiles/*/inventory*",
  ],
  world: "MAIN",
  main() {
    const inventoryContainer = document.getElementById("inventories");

    if (inventoryContainer) {
      const observer = new MutationObserver(() => {
        const win = window as any;
        const userSteamId = win.UserYou?.strSteamId;
        const tf2Inv = document.getElementById(
          `inventory_${userSteamId}_440_2`,
        );

        if (
          tf2Inv &&
          tf2Inv.style.display !== "none" &&
          tf2Inv.querySelectorAll(".item").length > 0
        ) {
          const invObserver = new MutationObserver(processInventory);
          invObserver.observe(tf2Inv, { childList: true });
          processInventory();
          observer.disconnect();
          observeItemSelection();
        }
      });

      observer.observe(inventoryContainer, { childList: true, subtree: true });
    }
  },
});
