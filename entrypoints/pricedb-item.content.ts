import { getSettings } from "@/utils/settings";

export default defineContentScript({
  matches: ["https://pricedb.io/item/*"],
  runAt: "document_idle",

  async main() {
    const settings = await getSettings();
    if (!settings.autobot.enabled || !settings.autobot.sites.pricedb) return;

    function getSkuFromUrl(): string | null {
      const parts = window.location.pathname.split("/");
      const idx = parts.indexOf("item");
      if (idx === -1 || idx + 1 >= parts.length) return null;
      return decodeURIComponent(parts[idx + 1]);
    }

    function insertButton(sku: string) {
      if (document.getElementById("tf2trader-autobot-btn")) return;

      const btn = document.createElement("button");
      btn.id = "tf2trader-autobot-btn";
      btn.textContent = "Copy !add";
      btn.title = `!add sku=${sku}`;
      btn.style.cssText =
        "background:#1a3a1a;border:1px solid #67d45e;color:#67d45e;" +
        "padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;" +
        "display:inline-block;margin-top:8px;";
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(`!add sku=${sku}`);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy !add"; }, 1500);
      });

      const heading =
        document.querySelector<HTMLElement>("h1") ??
        document.querySelector<HTMLElement>("h2");
      if (heading?.parentElement) {
        heading.parentElement.insertBefore(btn, heading.nextSibling);
      } else {
        document.body.prepend(btn);
      }
    }

    function tryInsert() {
      if (document.getElementById("tf2trader-autobot-btn")) return true;
      const sku = getSkuFromUrl();
      if (!sku) return false;
      insertButton(sku);
      return true;
    }

    if (!tryInsert()) {
      // pricedb.io is a SPA — observe for navigation/content changes
      const observer = new MutationObserver(() => {
        if (tryInsert()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Handle SPA route changes
    let lastPath = location.pathname;
    const navObserver = new MutationObserver(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        document.getElementById("tf2trader-autobot-btn")?.remove();
        tryInsert();
      }
    });
    navObserver.observe(document.body, { childList: true, subtree: true });
  },
});
