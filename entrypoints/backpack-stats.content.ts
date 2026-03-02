import { processListings } from "@/utils/backpack";

export default defineContentScript({
  matches: ["*://backpack.tf/stats/*"],

  main() {
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
      wrapper.style.margin = "20px 0";

      wrapper.innerHTML = `
      <iframe
          src="https://pricedb.io/api/graph/${sku}"
          style="width: 100%; height: 500px; border: none; background: #1b1b1b; margin: 10px 0; border-radius: 4px; border: 1px solid #222;"
      ></iframe>
      `;

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

    const contentWrapper =
      document.querySelector(".main-content") || document.body;
    const observer = new MutationObserver(processListings);

    observer.observe(contentWrapper, {
      childList: true,
      subtree: true,
    });

    moveClassifiedsToTop();
    insertGraph();
    processListings();
  },
});
