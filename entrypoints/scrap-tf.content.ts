import { getEffectID } from "@/utils";

const parseItemSku = (el: HTMLElement): string | null => {
  const defindex = el.dataset.defindex;
  if (!defindex) return null;

  const hash = el.dataset.itemGroupHash || "";
  const hashMatch = hash.match(/^it-\d+-\d+-(\d+)---craft-(\d?)/);

  let quality: string;
  if (hashMatch) {
    quality = hashMatch[1];
  } else {
    const qualityClass = [...el.classList].find((c) => c.match(/^quality\d+$/));
    quality = qualityClass?.replace("quality", "") ?? "6";
  }

  const craftable = hashMatch
    ? hashMatch[2]
      ? hashMatch[2] === "1"
      : !el.classList.contains("uncraft")
    : !el.classList.contains("uncraft");

  const title = el.dataset.title || "";
  const isAustralium = /australium/i.test(title);

  const content = el.dataset.content || "";
  const effectMatch = content.match(/Effect:\s*([^<]+)/);
  const effectName = effectMatch?.[1].trim();
  const unusualEffect = effectName ? getEffectID(effectName) : null;

  let sku = `${defindex};${quality}`;
  if (!craftable) sku += ";uncraftable";
  if (isAustralium) sku += ";australium";
  if (unusualEffect != null) sku += `;u${unusualEffect}`;

  return sku;
};

export default defineContentScript({
  matches: [
    "*://scrap.tf/buy*",
    "*://scrap.tf/sell*",
    "*://scrap.tf/unusuals*",
  ],
  runAt: "document_idle",
  main() {
    const handleContextMenu = (e: MouseEvent) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(
        ".item.hoverable",
      );
      if (!item) return;

      const sku = parseItemSku(item);
      if (!sku) return;

      document.getElementById("pricedb-ctx-menu")?.remove();

      const menu = document.createElement("div");
      menu.id = "pricedb-ctx-menu";
      menu.style.cssText = `
        position: fixed;
        z-index: 99999;
        background: #464545;
        border: 1px solid #464545;
        border-radius: 4px;
        padding: 4px 0;
        box-shadow: 0 4px 12px black;
        font-size: 13px;
        min-width: 180px;
      `;
      menu.style.left = `${e.clientX}px`;
      menu.style.top = `${e.clientY}px`;

      const option = document.createElement("a");
      option.href = `https://pricedb.io/item/${encodeURIComponent(sku)}`;
      option.target = "_blank";
      option.rel = "noopener noreferrer";
      option.style.cssText = `
        display: block;
        padding: 6px 14px;
        color: white;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
      `;
      option.textContent = `PriceDB (${sku})`;
      option.onmouseenter = () => (option.style.background = "#1b1b1b");
      option.onmouseleave = () => (option.style.background = "");

      menu.appendChild(option);
      document.body.appendChild(menu);

      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth)
        menu.style.left = `${e.clientX - rect.width}px`;
      if (rect.bottom > window.innerHeight)
        menu.style.top = `${e.clientY - rect.height}px`;

      e.preventDefault();
    };

    const dismissMenu = (e: MouseEvent) => {
      const menu = document.getElementById("pricedb-ctx-menu");
      if (menu && !menu.contains(e.target as Node)) {
        menu.remove();
      }
    };

    const dismissMenuOnScroll = () => {
      document.getElementById("pricedb-ctx-menu")?.remove();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", dismissMenu);
    document.addEventListener("scroll", dismissMenuOnScroll, { capture: true });
  },
});
