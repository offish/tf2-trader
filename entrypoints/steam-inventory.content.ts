import "@/styles/steam-inventory.css";
import { addAttributesToElement, getItemAttributes, buildSku, getDefindexFromDesc } from "@/utils/inventory";
import { fetchPricedbSearch } from "@/utils/pricedb-ipc";

// Page-lifetime cache: baseSku → resolved full SKU (avoids repeated network
// calls when the user clicks the same crate type multiple times).
const resolvedCrateSkus = new Map<string, string>();

// Guards concurrent injection for the same asset ID.
const inProgressAssets = new Set<string>();

// The most-recently clicked asset ID — used to discard stale async results
// when the user switches items while an in-flight search is running.
let currentSelectedAssetId = "";

const injectPricedbButton = async (assetId: string) => {
  console.log("[tf2-trader] injectPricedbButton called:", assetId, "inProgress:", inProgressAssets.has(assetId));
  if (inProgressAssets.has(assetId)) return;
  if (document.getElementById("pricedb-btn")?.getAttribute("data-asset") === assetId) return;

  inProgressAssets.add(assetId);
  try {
    const win = window as any;
    const assets =
      win.g_rgAppContextData?.[440]?.rgContexts?.[2]?.inventory?.m_rgAssets;
    if (!assets) return;

    const asset = assets[assetId];
    if (!asset) return;

    const defindex = getDefindexFromDesc(asset.description);
    if (!defindex) return;

    const attrs = getItemAttributes(asset.description);

    // Detect crates AND cases (cosmetic cases have localized_tag_name "Cosmetic Case", not "Crate").
    const typeTag = (asset.description?.tags as any[] | undefined)?.find(
      (t) => t.category === "Type",
    );
    const isCrate = !!typeTag && (
      (typeTag.internal_name as string ?? "").toLowerCase().includes("crate") ||
      (typeTag.internal_name as string ?? "").toLowerCase().includes("case") ||
      (typeTag.localized_tag_name as string ?? "").toLowerCase().includes("crate") ||
      (typeTag.localized_tag_name as string ?? "").toLowerCase().includes("case")
    );
    console.log("[tf2-trader] item:", asset.description?.market_hash_name, "isCrate:", isCrate, "series:", attrs.series, "typeTag:", typeTag);

    let sku = buildSku(defindex, attrs);

    // For crates where the series number wasn't found in tags or the item name,
    // fall back to the same name-search used by the trade-screen value panel.
    // fetchPricedbSearch goes through the inventory bridge → background pricedb_search,
    // which only resolves when PriceDB returns exactly one result — so the returned
    // SKU (e.g. "5849;6;c102") is unambiguous.
    if (isCrate && attrs.series === undefined) {
      const cachedFull = resolvedCrateSkus.get(sku);
      if (cachedFull) {
        sku = cachedFull;
      } else {
        const rawName = (asset.description?.market_hash_name ?? asset.description?.name ?? "") as string;
        const itemName = rawName.replace(/\bSeries\s+(?=#\d)/i, "");
        console.log("[tf2-trader] crate SKU search:", { baseSku: sku, rawName, itemName });

        if (itemName) {
          const found = await fetchPricedbSearch(itemName);
          console.log("[tf2-trader] crate SKU result:", found);
          if (found?.sku) {
            resolvedCrateSkus.set(sku, found.sku);
            sku = found.sku;
          }
        }
      }

      // The await above yields the event loop. If the user has since clicked a
      // different item, bail — the newer injectPricedbButton call will handle it.
      if (currentSelectedAssetId !== assetId) return;
    }

    document.getElementById("pricedb-btn")?.remove();

    const panels = Array.from(
      document.querySelectorAll<HTMLElement>("#iteminfo0, #iteminfo1"),
    );
    const activePanel =
      panels.find((p) => p.style.display !== "none") ?? panels[0];
    if (!activePanel) return;

    const container = document.createElement("div");
    container.id = "pricedb-btn";
    container.setAttribute("data-asset", assetId);
    container.style.cssText = "margin-bottom:10px;width:100%;";

    const pricedbLink = document.createElement("a");
    pricedbLink.href = `https://pricedb.io/item/${encodeURIComponent(sku)}`;
    pricedbLink.target = "_blank";
    pricedbLink.textContent = "Check prices on PriceDB.io";
    pricedbLink.style.cssText = "color:yellow;display:block;";
    container.appendChild(pricedbLink);

    if (isCrate) {
      const crateLink = document.createElement("a");
      crateLink.href = `http://crate.tf/item/${encodeURIComponent(sku)}`;
      crateLink.target = "_blank";
      crateLink.textContent = "View on Crate.tf";
      crateLink.style.cssText = "color:#67C1F5;display:block;margin-top:3px;";
      container.appendChild(crateLink);
    }

    const descBlock = activePanel.querySelector<HTMLElement>(
      ".item_desc_description, .item_desc_description_block",
    );
    const wikiLink = activePanel.querySelector<HTMLAnchorElement>(
      'a[href*="itemredirect.php"]',
    );
    if (descBlock?.parentElement) {
      descBlock.parentElement.insertBefore(container, descBlock);
    } else if (wikiLink?.parentElement) {
      wikiLink.parentElement.insertBefore(container, wikiLink);
    }
  } finally {
    inProgressAssets.delete(assetId);
  }
};

const observeItemSelection = () => {
  const win = window as any;
  console.log("[tf2-trader] observeItemSelection called");
  const userSteamId = win.UserYou?.strSteamId;
  console.log("[tf2-trader] userSteamId:", userSteamId);
  const tf2Inv = document.getElementById(`inventory_${userSteamId}_440_2`);
  console.log("[tf2-trader] tf2Inv:", tf2Inv?.id ?? "NOT FOUND");
  if (!tf2Inv) return;

  const onItemSelected = (assetId: string) => {
    console.log("[tf2-trader] item selected, assetId:", assetId);
    if (assetId === currentSelectedAssetId) return;
    currentSelectedAssetId = assetId;
    // setTimeout(0) lets Steam finish updating the info panel before we read it.
    setTimeout(() => injectPricedbButton(assetId).catch(console.error), 0);
  };

  // Use CAPTURE phase so we receive the event even if Steam calls stopPropagation()
  // on the item element's own handler. During capture, the event descends: document
  // → tf2Inv (our handler fires here) → item element → Steam's handler.
  tf2Inv.addEventListener("click", (e) => {
    // Walk from the actual click target upward to find the inventory item element.
    // Items inside the TF2 inventory have IDs containing "_440_2_" followed by assetId.
    // We can't rely on a specific CSS class since Steam may change it.
    let el = e.target as Element | null;
    while (el && el !== tf2Inv) {
      if (el.id) {
        // Match inventory item IDs: e.g. "item_440_2_ASSETID" or "STEAMID_440_2_ASSETID"
        const m = el.id.match(/_440_2_(\d+)$/);
        if (m) { onItemSelected(m[1]); return; }
        // Fallback: class-based check with last-segment assetId
        if (el.classList.contains("item")) {
          const assetId = el.id.split("_").at(-1);
          if (assetId && /^\d+$/.test(assetId)) { onItemSelected(assetId); return; }
        }
      }
      el = el.parentElement;
    }
  }, true /* capture */);

  // Fallback observer on item info panels.
  // Steam updates #iteminfo0/#iteminfo1 whenever a new item is selected.
  // g_ActiveInventory.selectedItem gives us the currently selected asset.
  const onPanelMutation = () => {
    const activeInv = win.g_ActiveInventory;
    if (!activeInv) return;
    const sel = activeInv.selectedItem ?? activeInv.m_selectedItem;
    if (!sel) return;
    const assetId = String(sel.id ?? sel.assetid ?? sel.m_iAssetID ?? "");
    if (assetId && /^\d+$/.test(assetId)) onItemSelected(assetId);
  };

  for (const panelId of ["iteminfo0", "iteminfo1"]) {
    const panel = document.getElementById(panelId);
    if (panel) {
      new MutationObserver(onPanelMutation).observe(panel, {
        childList: true,
        subtree: true,
      });
    }
  }
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
    const assetId = itemEl.id.split("_").at(-1)!;
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
      let setupDone = false;
      const observer = new MutationObserver(() => {
        if (setupDone) return;
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
          setupDone = true;
          observer.disconnect();
          const invObserver = new MutationObserver(processInventory);
          invObserver.observe(tf2Inv, { childList: true });
          processInventory();
          observeItemSelection();
        }
      });

      observer.observe(inventoryContainer, { childList: true, subtree: true });
    }
  },
});
