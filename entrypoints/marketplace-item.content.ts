import { QUALITY_NAMES, KILLSTREAK_TIER_NAMES } from "@/utils/data";
import { getSettings } from "@/utils/settings";

export default defineContentScript({
  matches: ["*://marketplace.tf/items/*"],
  runAt: "document_idle",
  async main() {
    const settings = await getSettings();
    if (!settings.sites.marketplace) return;

    const injectOldButton = () => {
      const bpButtons = document.querySelectorAll<HTMLAnchorElement>(
        "#btnBackpackTFStats:not(.processed)",
      );

      bpButtons.forEach((btn) => {
        try {
          const url = new URL(btn.href);
          const params = new URLSearchParams(url.search);

          const itemName = params.get("item") || "";
          const quality = Number(params.get("quality")) || 6;
          const craftable = params.get("craftable") ?? "1";
          const killstreakTier = Number(params.get("killstreakTier")) || 0;
          const priceindex = params.get("priceindex") || null;
          const sheen = params.get("sheen") || null;
          const killstreaker = params.get("killstreaker") || null;
          const wearTier = params.get("wearTier") || null;
          const texture = params.get("texture") || null;

          const isCraftable = craftable === "1" ? "Craftable" : "Non-Craftable";
          const qualityName = QUALITY_NAMES[quality];
          const killstreakPrefix = KILLSTREAK_TIER_NAMES[killstreakTier];

          let resolvedItemName: string;
          let resolvedIndex: string | null = priceindex;

          if (wearTier && texture) {
            resolvedItemName = `${texture} | ${itemName} (${wearTier})`;
          } else if (itemName === "Kit" && killstreakPrefix) {
            resolvedItemName = `${killstreakPrefix} ${itemName}`;
            if (
              sheen &&
              killstreaker &&
              sheen !== "-1" &&
              killstreaker !== "-1"
            ) {
              resolvedIndex = `${sheen}-${killstreaker}`;
            }
          } else {
            resolvedItemName = killstreakPrefix
              ? `${killstreakPrefix} ${itemName}`
              : itemName;
          }

          const basePath = `https://backpack.tf/stats/${qualityName}/${encodeURIComponent(resolvedItemName)}/Tradable/${isCraftable}`;
          const oldUrl = resolvedIndex
            ? `${basePath}/${resolvedIndex}`
            : basePath;

          const oldBtn = document.createElement("a");
          oldBtn.className = btn.className;
          oldBtn.target = "_blank";
          oldBtn.rel = "noopener noreferrer tooltip";
          oldBtn.title = "View on Old BackpackTF";
          oldBtn.href = oldUrl;
          oldBtn.innerText = "Old BackpackTF ";

          const icon = document.createElement("i");
          icon.className = "stm stm-backpack-tf";
          oldBtn.appendChild(icon);

          oldBtn.style.marginRight = "4px";

          btn.parentNode?.insertBefore(oldBtn, btn);
          btn.classList.add("processed");
        } catch (e) {
          console.error("Failed to parse BP.tf button", e);
        }
      });
    };

    injectOldButton();

    const observer = new MutationObserver(() => injectOldButton());
    observer.observe(document.body, { childList: true, subtree: true });
  },
});
