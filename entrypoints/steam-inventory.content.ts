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

  const link = document.createElement("a");
  link.id = "pricedb-btn";
  link.href = `https://pricedb.io/item/${encodeURIComponent(sku)}`;
  link.target = "_blank";
  link.textContent = "🔍 Check on PriceDB.IO";
  link.setAttribute("data-asset", assetId);
  link.style.cssText = `
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 4px;
    color: #ffffff !important;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none !important;
    text-align: center;
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.2s ease, border-color 0.2s ease;
    pointer-events: all !important;
    position: relative;
    z-index: 999;
  `;

  link.addEventListener("mouseenter", () => {
    link.style.background = "linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)";
    link.style.borderColor = "rgba(255,255,255,0.35)";
  });
  link.addEventListener("mouseleave", () => {
    link.style.background = "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)";
    link.style.borderColor = "rgba(255,255,255,0.15)";
  });

  wikiLink.parentElement!.insertBefore(link, wikiLink);
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
