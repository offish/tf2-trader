import "@/styles/steam-inventory.css";

export default defineContentScript({
  matches: [
    "*://steamcommunity.com/id/*/inventory*",
    "*://steamcommunity.com/profiles/*/inventory*",
  ],
  world: "MAIN",

  main() {
    const processInventory = () => {
      const win = window as any;
      const inventoryData =
        win.g_rgAppContextData?.[440]?.rgContexts?.[2]?.inventory;

      if (!inventoryData) return;

      const userSteamId = win.UserYou?.strSteamId;
      const tf2InvEl = document.getElementById(
        `inventory_${userSteamId}_440_2`,
      );

      if (!tf2InvEl) return;

      const assets = inventoryData.m_rgAssets;
      const items = tf2InvEl.querySelectorAll(".item:not(.pendingItem)");

      items.forEach((itemEl) => {
        const assetId = itemEl.id.split("_")[2];
        const asset = assets[assetId];
        if (asset)
          addAttributesToElement(itemEl as HTMLElement, asset.description);
      });
    };

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
        }
      });

      observer.observe(inventoryContainer, { childList: true, subtree: true });
    }
  },
});
