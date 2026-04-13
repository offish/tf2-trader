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

    function parseSalesData(
      container: Element,
    ): { labels: string[]; sold: number[] } | null {
      const script = Array.from(
        container.querySelectorAll<HTMLScriptElement>(
          "script[type='text/javascript']",
        ),
      ).find((s) => s.textContent?.includes("Number Sold"));

      if (!script || !script.textContent) return null;

      const labelsMatch = script.textContent.match(/labels\s*:\s*\[([^\]]+)\]/);
      const soldMatch = script.textContent.match(
        /label:\s*"Number Sold"[\s\S]*?data:\s*\[([^\]]+)\]/,
      );

      if (!labelsMatch || !soldMatch) return null;

      const labels = [...labelsMatch[1].matchAll(/"([^"]+)"/g)].map(
        (m) => m[1],
      );
      const sold = [...soldMatch[1].matchAll(/"(\d+)"/g)].map((m) =>
        parseInt(m[1], 10),
      );

      return { labels, sold };
    }

    function getLast30DaysSales(labels: string[], sold: number[]): number {
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - 30);

      let total = 0;
      for (let i = 0; i < labels.length; i++) {
        const date = new Date(labels[i]);
        if (date >= cutoff) {
          total += sold[i] ?? 0;
        }
      }
      return total;
    }

    function injectBadge(container: Element, count: number): void {
      if (container.querySelector(".mptf-sales-badge")) return;

      const badge = document.createElement("div");
      badge.className = "mptf-sales-badge";
      badge.innerHTML = `
        <span class="mptf-sales-label">Sales last 30 days:</span>
        <span class="mptf-sales-count">${count}</span>
      `;

      container.insertBefore(badge, container.firstChild);
    }

    function injectStyles(): void {
      if (document.getElementById("mptf-stats-styles")) return;

      const style = document.createElement("style");
      style.id = "mptf-stats-styles";
      style.textContent = `
        .mptf-sales-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding: 5px 12px 5px 10px;
          border-radius: 6px;
          float: right;
          font-size: 13px;
          line-height: 1;
        }
 
        .mptf-sales-label {
          color: rgba(255, 255, 255, 0.6);
          font-weight: normal;
        }
 
        .mptf-sales-count {
          color: #DDD;
          font-weight: bold;
          font-size: 15px;
        }
      `;
      document.head.appendChild(style);
    }

    function process(): void {
      const containers = document.querySelectorAll<HTMLElement>(
        "#itemSalesGraphContainer",
      );

      containers.forEach((container) => {
        if (container.querySelector(".mptf-sales-badge")) return;

        const data = parseSalesData(container);
        if (!data) return;

        const count = getLast30DaysSales(data.labels, data.sold);
        injectStyles();
        injectBadge(container, count);
      });
    }

    injectOldButton();
    process();

    const observer = new MutationObserver(() => {
      injectOldButton();
      process();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },
});
