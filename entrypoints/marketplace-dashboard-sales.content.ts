export default defineContentScript({
  // Browser extension match patterns do NOT support hash (#) fragments.
  // "*://marketplace.tf/dashboard#sales" will never match anything.
  matches: ["*://marketplace.tf/dashboard*"],
  runAt: "document_idle",
  main() {
    if (!location.hash.includes("sales")) return;

    const COLOR_TO_QUALITY: Record<string, string> = {
      "#B2B2B2": "Normal",
      "#4D7455": "Genuine",
      "#476291": "Vintage",
      "#7D6D00": "Unique",
      "#8650AC": "Unusual",
      "#70B04A": "Self-Made",
      "#CF6A32": "Strange",
      "#38F3AB": "Haunted",
      "#AA0000": "Collector's",
      "#FAFAFA": "Decorated",
    };

    function getQualityFromSpan(span: HTMLSpanElement): string {
      const style = span.getAttribute("style") ?? "";
      const match = style.match(/color\s*:\s*(#[0-9A-Fa-f]{6})/i);

      if (match) {
        const hex = match[1].toUpperCase();
        return COLOR_TO_QUALITY[hex] ?? "Unique";
      }

      return "Unique";
    }

    function getBackpackTfUrl(itemName: string, quality: string): string {
      let cleaned = itemName.replace(/^Uncraftable\s+/i, "");

      if (itemName.includes(quality))
        cleaned = cleaned.replace(quality + " ", "");

      const encoded = encodeURIComponent(cleaned);
      const craftable = itemName.includes("Uncraftable")
        ? "Non-Craftable"
        : "Craftable";

      return `https://backpack.tf/stats/${quality}/${encoded}/Tradable/${craftable}`;
    }

    function createCopyButton(itemName: string): HTMLButtonElement {
      const btn = document.createElement("button");
      btn.title = "Copy item name";
      btn.className = "mptf-btn mptf-btn-copy";
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>`;

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(itemName);
          btn.classList.add("mptf-btn-success");
          btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>`;
          setTimeout(() => {
            btn.classList.remove("mptf-btn-success");
            btn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>`;
          }, 1500);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = itemName;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
      });

      return btn;
    }

    function createBackpackButton(
      itemName: string,
      quality: string,
    ): HTMLAnchorElement {
      const btn = document.createElement("a");
      btn.title = "Open on backpack.tf";
      btn.className = "mptf-btn mptf-btn-backpack";

      btn.href = getBackpackTfUrl(itemName, quality);
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>`;

      return btn;
    }

    function injectStyles(): void {
      if (document.getElementById("mptf-injected-styles")) return;

      const style = document.createElement("style");
      style.id = "mptf-injected-styles";
      style.textContent = `
        .mptf-item-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          vertical-align: middle;
        }

        .mptf-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 0;
          text-decoration: none;
          flex-shrink: 0;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
          vertical-align: middle;
          font-size: 0;
          line-height: 1;
        }

        .mptf-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.35);
          transform: scale(1.08);
        }

        .mptf-btn:active {
          transform: scale(0.94);
        }

        .mptf-btn-success {
          background: rgba(76, 175, 80, 0.25) !important;
          color: #81c784 !important;
          border-color: rgba(76, 175, 80, 0.5) !important;
        }

        .mptf-btn-backpack:hover {
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.35);
        }
      `;
      document.head.appendChild(style);
    }

    function injectButtons(): void {
      const itemSpans = document.querySelectorAll<HTMLSpanElement>(
        "span.item-html-name:not([data-mptf-enhanced])",
      );

      const ignoreItems = [
        "Random Craft Hat",
        "Refined Metal",
        "Reclaimed Metal",
        "Scrap Metal",
      ];

      itemSpans.forEach((span) => {
        const rawName = span.textContent?.trim() ?? "";
        if (!rawName) return;

        const quality = getQualityFromSpan(span);

        span.setAttribute("data-mptf-enhanced", "true");

        const wrapper = document.createElement("span");
        wrapper.className = "mptf-item-wrapper";

        span.parentNode?.insertBefore(wrapper, span);
        wrapper.appendChild(span);
        wrapper.appendChild(createCopyButton(rawName));

        if (ignoreItems.includes(rawName)) return;

        wrapper.appendChild(createBackpackButton(rawName, quality));
      });
    }

    injectStyles();
    injectButtons();

    // MutationObserver catches the table being rendered by the SPA after
    // hash-based navigation (e.g. clicking the Sales tab → #sales)
    const observer = new MutationObserver(() => {
      injectButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
