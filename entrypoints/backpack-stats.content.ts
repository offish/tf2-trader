import { processListings } from "@/utils/backpack";
import { debounce } from "@/utils";
import { createPricedbGraphIframe } from "@/utils/graph";
import { getSettings } from "@/utils/settings";
import { TAG_TO_QUALITY } from "@/utils/data";

export default defineContentScript({
  matches: ["*://backpack.tf/stats/*"],

  async main() {
    const settings = await getSettings();
    if (!settings.sites.backpackStats) return;

    const autobotEnabled =
      settings.autobot.enabled && settings.autobot.sites.backpackStats;
    const moveClassifiedsToTop = () => {
      const classifieds = document.querySelector("#classifieds");

      if (!classifieds) return;

      const parentPanel = classifieds.closest(".stats-body");
      const relatedGutter = classifieds.nextElementSibling;

      if (parentPanel) {
        if (relatedGutter && relatedGutter.classList.contains("guttered")) {
          parentPanel.prepend(relatedGutter);
        }
        parentPanel.prepend(classifieds);
      }
    };

    function getSkuFromMarketplaceLink(): string | null {
      const anchor = document.querySelector<HTMLAnchorElement>(
        'a.price-box[href*="marketplace.tf/partneritem"]',
      );

      if (!anchor) return null;

      try {
        const url = new URL(anchor.href);
        return url.searchParams.get("sku");
      } catch (e) {
        console.error("Failed to parse Marketplace.tf URL", e);
        return null;
      }
    }

    function insertGraph() {
      if (document.getElementById("pricedb-graph-wrapper")) return;

      const sku = getSkuFromMarketplaceLink();

      if (!sku) {
        console.warn("[pricedb-graph] Could not find SKU on this page.");
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.id = "pricedb-graph-wrapper";
      wrapper.style.cssText = "margin:20px 0;background:#1b1b1b;border:1px solid #222;border-radius:4px;";
      wrapper.appendChild(createPricedbGraphIframe(sku));

      const nativeGraphSection = document.querySelector(
        ".guttered:has(.stats-graph)",
      );

      if (nativeGraphSection) {
        nativeGraphSection.before(wrapper);
      } else {
        const fallbackHeader = document.querySelector("h2");
        fallbackHeader?.before(wrapper);
      }
    }

    function insertAutobotButton(sku: string) {
      if (document.getElementById("tf2trader-autobot-btn")) return;

      const btn = document.createElement("button");
      btn.id = "tf2trader-autobot-btn";
      btn.textContent = "Copy !add";
      btn.title = `!add sku=${sku}`;
      btn.style.cssText =
        "background:#1a3a1a;border:1px solid #67d45e;color:#67d45e;" +
        "padding:4px 10px;border-radius:4px;cursor:pointer;font-size:13px;margin-left:10px;vertical-align:middle;";
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(`!add sku=${sku}`);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy !add"; }, 1500);
      });

      const anchor =
        document.querySelector<HTMLElement>(".stats-header-title") ??
        document.querySelector<HTMLElement>("h1");
      if (anchor?.parentElement) {
        anchor.parentElement.insertBefore(btn, anchor.nextSibling);
      }
    }

    async function buildSkuFromUrl(): Promise<string | null> {
      const parts = window.location.pathname.split("/").filter(Boolean);
      // ['stats', qualityName, itemName, 'Tradable', 'Craftable', optEffectId?]
      if (parts.length < 5) return null;

      const qualityName = decodeURIComponent(parts[1]);
      const itemName = decodeURIComponent(parts[2]);
      const qualityId = TAG_TO_QUALITY[qualityName];
      if (qualityId === undefined) return null;

      const lastPart = parts[parts.length - 1];
      const effectId =
        parts.length >= 6 && /^\d+$/.test(lastPart) ? parseInt(lastPart, 10) : null;

      const result = (await browser.runtime.sendMessage({
        type: "pricedb_search",
        query: itemName,
      })) as { keys: number; metal: number; sku: string } | null;
      if (!result?.sku) return null;

      const defindex = result.sku.split(";")[0];
      let sku = `${defindex};${qualityId}`;
      if (qualityId === 5 && effectId !== null) {
        sku += `;u${effectId}`;
      }
      return sku;
    }

    async function tryInsertAutobotButton() {
      if (!autobotEnabled) return;
      if (document.getElementById("tf2trader-autobot-btn")) return;

      // Prefer SKU from marketplace.tf link (most reliable)
      const sku = getSkuFromMarketplaceLink() ?? (await buildSkuFromUrl());
      if (sku) insertAutobotButton(sku);
    }

    const contentWrapper =
      document.querySelector(".main-content") || document.body;
    const observer = new MutationObserver(debounce(processListings, 300));

    observer.observe(contentWrapper, {
      childList: true,
      subtree: true,
    });

    moveClassifiedsToTop();
    insertGraph();
    processListings();
    tryInsertAutobotButton();
  },
});
