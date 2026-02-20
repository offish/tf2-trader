// entrypoints/steam-inventory.content.ts
import "./assets/inventory.css";
import { UNUSUAL_EFFECT_MAP } from "../utils/effects";
export default defineContentScript({
  matches: [
    "*://steamcommunity.com/id/*/inventory*",
    "*://steamcommunity.com/profiles/*/inventory*",
  ],
  // 'MAIN' world is required to access the Steam page's global variables (g_rgAppContextData)
  world: "MAIN",

  main() {
    const getEffectURL = (value: number) =>
      `https://itempedia.tf/assets/particles/${value}_94x94.png`;

    const getItemAttributes = (item: any) => {
      const attributes: any = { color: (item.name_color || "").toUpperCase() };
      const isUnique = attributes.color === "7D6D00";
      const isStrangeQuality = attributes.color === "CF6A32";

      const matchesLowcraft = item.name?.match(/.* #(\d+)$/);
      if (matchesLowcraft) attributes.lowcraft = parseInt(matchesLowcraft[1]);

      const hasStrangeItemType =
        /^Strange /.test(item.market_hash_name) &&
        item.type &&
        /^Strange ([0-9\w\s\\(\)'\-]+) \- ([0-9\w\s\(\)'-]+): (\d+)\n?$/.test(
          item.type,
        );

      if (!isStrangeQuality && hasStrangeItemType) attributes.strange = true;
      if (!item.descriptions) return attributes;

      item.descriptions.forEach((desc: any) => {
        const effectMatch =
          !isUnique &&
          desc.color === "ffd700" &&
          desc.value.match(/^\u2605 Unusual Effect: (.+)$/);
        if (effectMatch && UNUSUAL_EFFECT_MAP[effectMatch[1]])
          attributes.effect = UNUSUAL_EFFECT_MAP[effectMatch[1]];

        if (
          desc.color === "7ea9d1" &&
          desc.value.includes("(spell only active during event)")
        )
          attributes.spelled = true;
        if (desc.color === "756b5e" && desc.value.match(/^\(?(.+?):\s*\d+\)?$/))
          attributes.parts = true;
        if (desc.color === "7ea9d1" && desc.value === "Killstreaks Active")
          attributes.killstreak = true;
        if (!desc.color && /^\( Not.* Usable in Crafting/.test(desc.value))
          attributes.uncraft = true;
        if (
          !isStrangeQuality &&
          desc.color?.toUpperCase() === "CF6A32" &&
          desc.value.trim() === "Strange Stat Clock Attached"
        ) {
          attributes.strange = true;
        }
      });

      return attributes;
    };

    const addAttributesToElement = (itemEl: HTMLElement, item: any) => {
      if (itemEl.hasAttribute("data-checked")) return;

      const attrs = getItemAttributes(item);
      const iconsEl = document.createElement("div");
      const classes: string[] = [];

      if (attrs.effect) {
        itemEl.style.backgroundImage = `url('${getEffectURL(attrs.effect)}')`;
        classes.push("unusual");
      }
      if (attrs.strange) classes.push("strange");
      if (attrs.uncraft) classes.push("uncraft");

      if (attrs.lowcraft) {
        const div = document.createElement("div");
        div.textContent = `#${attrs.lowcraft}`;
        div.className = "lowcraft";
        div.style.color = `#${attrs.color}`;
        itemEl.appendChild(div);
      }

      const addIcon = (src: string, cls: string) => {
        const img = document.createElement("img");
        img.src = src;
        img.className = cls;
        iconsEl.appendChild(img);
      };

      if (attrs.spelled) addIcon("https://scrap.tf/img/spell.png", "spell");
      if (attrs.parts)
        addIcon("https://itempedia.tf/assets/wrench.png", "parts");
      if (attrs.killstreak)
        addIcon("https://itempedia.tf/assets/icon-ks.png", "ks");

      if (iconsEl.children.length > 0) {
        iconsEl.className = "icons";
        itemEl.appendChild(iconsEl);
      }

      if (classes.length > 0) itemEl.classList.add(...classes);
      itemEl.setAttribute("data-checked", "1");
    };

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

    // Main logic: Observer to wait for TF2 inventory to load
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
          // Once found, we observe the TF2 inventory specifically for page changes
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
