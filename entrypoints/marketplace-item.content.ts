import { QUALITY_NAMES } from "@/types";

export default defineContentScript({
  matches: ["*://marketplace.tf/items/*"],
  runAt: "document_idle",
  main() {
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
          const craftable = params.get("craftable") || "1";

          const isCraftable = craftable === "1" ? "Craftable" : "Non-Craftable";
          const qualityName = QUALITY_NAMES[quality];
          const oldUrl = `https://backpack.tf/stats/${qualityName}/${encodeURIComponent(itemName)}/Tradable/${isCraftable}`;

          const oldBtn = document.createElement("a");

          oldBtn.className = btn.className;
          oldBtn.target = "_blank";
          oldBtn.rel = "noopener noreferrer tooltip";
          oldBtn.title = "View on Old BackpackTF";
          oldBtn.href = oldUrl;
          oldBtn.innerText = "Old BackpackTF";

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

    // Initial run
    injectOldButton();

    const observer = new MutationObserver(() => injectOldButton());
    observer.observe(document.body, { childList: true, subtree: true });
  },
});
