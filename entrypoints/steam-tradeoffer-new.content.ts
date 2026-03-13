import { ParsedItem, SteamRgEntry } from "@/types";

export default defineContentScript({
  matches: ["https://steamcommunity.com/tradeoffer/new*"],
  world: "MAIN",
  runAt: "document_idle",
  async main() {
    const params = new URLSearchParams(location.search);

    // -------------------------------------------------------------------------
    // PriceDB helpers — defined here so they run on ALL tradeoffer/new pages,
    // not just listing auto-builds.
    // -------------------------------------------------------------------------

    function toTradeItem(assetId: string) {
      return { appid: 440, contextid: "2", amount: 1, assetid: assetId };
    }

    /** Metal (ref) value of each currency item. */
    const CURRENCY_DEFINDEXES: Record<string, { keys: number; metal: number }> =
      {
        "5021": { keys: 1, metal: 0 }, // Mann Co. Supply Crate Key
        "5000": { keys: 0, metal: 1 }, // Refined Metal
        "5001": { keys: 0, metal: 1 / 3 }, // Reclaimed Metal
        "5002": { keys: 0, metal: 1 / 9 }, // Scrap Metal
      };

    // Cache SKU prices for the lifetime of the page so repeated panel
    // refreshes don't re-request the same items.
    const priceCache = new Map<
      string,
      { keys: number; metal: number } | null
    >();

    // The content script runs in world:MAIN (Steam's page), which is bound by
    // Steam's CSP — direct fetch() to pricedb.io is blocked.  Instead we post
    // a message to the ISOLATED bridge script (tradeoffer-pricedb-bridge), which
    // forwards the request through the background service worker.
    async function fetchPricedbPrice(
      sku: string,
    ): Promise<{ keys: number; metal: number } | null> {
      if (priceCache.has(sku)) return priceCache.get(sku)!;

      const result = await new Promise<{ keys: number; metal: number } | null>(
        (resolve) => {
          const id = Math.random().toString(36).slice(2);
          const timer = setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve(null);
          }, 5000);
          const handler = (e: MessageEvent) => {
            if (
              e.data?.type === "tf2trader_pricedb_response" &&
              e.data?.id === id
            ) {
              clearTimeout(timer);
              window.removeEventListener("message", handler);
              resolve(e.data.result ?? null);
            }
          };
          window.addEventListener("message", handler);
          window.postMessage(
            { type: "tf2trader_pricedb_request", sku, id },
            "*",
          );
        },
      );

      priceCache.set(sku, result);
      return result;
    }

    /** Search pricedb by name — only used as a fallback when the SKU is incomplete.
     *  Returns price + resolved SKU when there is exactly one matching result. */
    async function fetchPricedbSearch(
      query: string,
    ): Promise<{ keys: number; metal: number; sku: string } | null> {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        const timer = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve(null);
        }, 5000);
        const handler = (e: MessageEvent) => {
          if (
            e.data?.type === "tf2trader_pricedb_search_response" &&
            e.data?.id === id
          ) {
            clearTimeout(timer);
            window.removeEventListener("message", handler);
            resolve(e.data.result ?? null);
          }
        };
        window.addEventListener("message", handler);
        window.postMessage(
          { type: "tf2trader_pricedb_search_request", query, id },
          "*",
        );
      });
    }

    async function sideValueInKeys(
      assets: Array<{ assetid: string }>,
      rgMap: Record<string, any>,
      keyPriceRef: number,
    ): Promise<{ total: number; missing: number; unpricedNames: string[] }> {
      let totalKeys = 0;
      let missing = 0;
      const unpricedNames: string[] = [];
      const fetches: Promise<void>[] = [];

      for (const asset of assets) {
        const desc = rgMap[asset.assetid];
        if (!desc) {
          missing++;
          continue;
        }

        const defindex = getDefindexFromDesc(desc);

        if (defindex && CURRENCY_DEFINDEXES[defindex]) {
          const c = CURRENCY_DEFINDEXES[defindex];
          totalKeys += c.keys + (keyPriceRef > 0 ? c.metal / keyPriceRef : 0);
          continue;
        }

        if (!defindex) {
          const name = desc.market_hash_name ?? desc.name ?? "Unknown";
          unpricedNames.push(name);
          missing++;
          continue;
        }

        const attrs = getItemAttributes(desc);
        const sku = buildSku(defindex, attrs);
        console.log("[tf2-trader] SKU debug:", {
          name: desc.market_hash_name ?? desc.name,
          defindex,
          attrs,
          sku,
        });

        // Strip "Series #" → "#" so "Mann Co. Supply Crate Series #75"
        // matches pricedb's canonical name "Mann Co. Supply Crate #75".
        const itemName = (desc.market_hash_name ?? desc.name ?? "").replace(
          /\bSeries\s+(?=#\d)/i,
          "",
        );

        fetches.push(
          fetchPricedbPrice(sku).then(async (price) => {
            if (!price) {
              // Fallback: search by name — handles crates where the series
              // number was not available when building the SKU.
              const found = await fetchPricedbSearch(itemName);
              if (found) {
                const resolved = { keys: found.keys, metal: found.metal };
                priceCache.set(sku, resolved); // cache under original SKU
                priceCache.set(found.sku, resolved); // and resolved SKU
                console.log(
                  `[tf2-trader] Search resolved ${sku} → ${found.sku}`,
                );
                totalKeys +=
                  resolved.keys +
                  (keyPriceRef > 0 ? resolved.metal / keyPriceRef : 0);
              } else {
                unpricedNames.push(itemName);
                missing++;
              }
              return;
            }
            totalKeys +=
              price.keys + (keyPriceRef > 0 ? price.metal / keyPriceRef : 0);
          }),
        );
      }

      await Promise.all(fetches);
      return { total: totalKeys, missing, unpricedNames };
    }

    // Inline SVG logo (scaled from public/logo.svg, 1200x1200 canvas).
    const LOGO_SVG = `<svg width="18" height="18" viewBox="-30 -30 1260 1260" xmlns="http://www.w3.org/2000/svg"><path fill="#67D35E" d="M0 0 C6.9 7.7 7.3 15.8 7.4 25.7 C7.5 33.1 7.5 40.8 7.5 40.8 C7.6 73.8 4.7 104.3 1.1 135 C-1.5 157.8 -4.5 184.8 -6.1 198.3 C-7.6 211.4 -9.1 224.4 -10.5 237.5 C-13.3 262.3 -14.7 274.9 -16.2 287.4 C-17 295.6 -17.8 303.9 -20.1 322.4 C-22.5 342.7 -24 355.9 -26.2 365.4 C-34.4 371.9 -44.6 374.9 -49.9 378.3 C-70.5 385.5 -89.5 395.4 -106 410 C-124.7 426.6 -137.6 442.8 -147.5 461.3 C-163.5 477.9 -188 475.3 -199.6 474 C-248.7 468.6 -284.1 464.6 -312.5 461.5 C-337.7 458.7 -389.4 452.9 -409 450.9 C-424.5 449.3 -438.6 447.8 -452.6 446.4 C-462.5 445.3 -471.3 442.7 -478 435 C-481.3 429.5 -482.1 423.6 -482.3 417.3 C-482.4 409.3 -482.5 404.8 -482.5 400.2 C-483.3 369 -480.3 352.7 -473 333 C-453.6 277.5 -429.1 233.4 -399 194 C-388.5 180.3 -378.8 168.9 -368.6 157.8 C-357.8 145.8 -345.9 133.7 -341 131 C-341 130.3 -341 129.7 -341 129 C-337.9 126.2 -333 122 -333 122 C-330 121.1 -326 117.1 -287.7 88 C-225.1 40.6 -152.2 17.9 -71.9 3.4 C-63.9 1.9 -56.2 0 -48 0 C-56.2 0 -48 0 0 0 Z" transform="translate(597,106)"/><path fill="#67D35E" d="M0 0 C2.7 0.3 5.3 0.6 8 0.9 C20 2.2 42.6 4.7 50.1 5.5 C77.1 8.4 104.1 11.4 131.7 14.3 C149.6 16.2 185.4 20 214.4 23.6 C240 26.6 263.4 29.1 271.2 38.1 C275.9 45.8 276.1 53 276.1 61.8 C276.2 74.1 276.3 82.5 276.4 82.5 C276.9 103.8 273.8 121.2 266.5 141.3 C238.4 214.9 208 266.7 168.6 310 C143.1 338.6 115.4 364.2 87.2 382 C72.6 391.2 57.8 400.6 31.5 420.3 C-29.6 454.4 -96.8 473.1 -163.6 479.2 C-190.4 481.5 -202.3 474.7 -210.8 465.9 C-211.3 444.5 -208.7 377.2 -204.6 344.9 C-200.5 312.0 -197.4 279.4 -193 251.9 C-188.2 213.2 -185.1 187.8 -181.9 162.3 C-178.6 135.5 -175.5 108.7 -178.6 98.9 C-166.8 92.4 -152 94.1 -152 92.4 C-114.1 75.2 -97.5 61.3 -82.5 46.3 C-73.4 35.3 -66.5 25.4 -60.4 14.7 C-46.5 -9.2 -23.9 -2.7 0 0 Z M-20.5 50.3 C-22.8 53.8 -25.7 57.9 -27.2 60.1 C-33 68.6 -39.4 76.3 -46.3 83.9 C-55.5 94.5 -63.5 101.3 -63.5 101.3 C-76.4 112.4 -87.5 119.7 -99.3 126.4 C-115.7 133.1 -126.5 139.3 -126.5 139.3 C-127.9 143.3 -128.3 147.4 -128.6 151.7 C-132 179.6 -134.6 202.8 -136.9 222.1 C-139.3 244.8 -141 256.2 -141 256.2 C-144.9 266.8 -148.2 315.3 -154.5 375.3 C-108.5 372.5 -60.9 357.1 -19.5 337.3 C32 311.2 61.4 290.9 87.2 267.4 C125 232.3 157.9 192.5 186.5 143.3 C206.4 109.9 215.5 76.3 215.5 76.3 C192 73.5 126 66 48 57.7 C23.5 55 1.5 52.6 -20.5 50.3 Z" transform="translate(809,671)"/><path fill="#67D35E" d="M0 0 C1.1 0.1 2.2 0.2 3.5 0.4 C14.2 1.6 22.2 2.6 22.2 2.6 C67.2 7.7 93.5 11.9 114.2 17.2 C137.7 23.3 157.9 31.0 177.2 45.1 C195.9 58.7 213.2 74.6 227.6 91.6 C238.5 104.6 247.7 118.2 252.3 130 C255 136.8 263.8 149.8 274.8 163.5 C282.6 172.9 287.6 181.4 289.7 191.3 C291.1 196.6 291 201.9 291 207.3 C291.2 229.9 288.6 259.7 285.1 289.8 C278.7 345 270.7 399.9 261.3 454 C258.3 471.8 255.6 489.7 252.6 507.5 C249.7 524.8 246.8 542 243.9 559.3 L194 554.1 C139.4 548.2 58.1 539.5 31.5 536.5 C14.7 534.6 -9.6 533.6 -9.6 533.6 C-21.1 533.2 -29.1 530.0 -36.7 522.5 C-37.3 506.5 -38.6 490.7 -42.8 479.6 C-47.8 464.1 -49.2 453.8 -61.9 418.8 C-74.9 383.5 -77.4 364.7 -77.4 364.7 C-79.2 355.8 -78.7 346.2 -78.8 337.1 C-79.1 301.9 -75.4 269 -71.6 236.1 C-65.1 178.3 -56.8 110.2 -49.9 53.5 C-47.6 33.9 -45.4 14.6 -46.9 7.1 C-36.3 -3 -23.5 -1.5 0 0 Z M2.2 56.6 C-6.1 125.2 -15.5 194.9 -24.8 264.6 L-16.3 271 C-7.0 277.4 5.7 286.4 5.7 286.4 C21.2 297.4 33.2 309.2 39.4 326.4 C41.0 327.4 42.6 329.0 44.4 331.1 C62.2 352.2 74.8 374.8 64.4 398.9 C66.2 401.6 68.1 402.1 72 402.3 C107 406 143 410 177.8 414 C205.7 417.1 245.9 421.7 274.3 425 C300.2 425.6 300.2 425.6 300.2 425.6 C301.7 385.5 283.8 337 267.3 301.0 C250.3 264.5 232.6 233.9 212.2 207.6 C205.6 199.0 200.3 192.4 194.5 186 C185.3 175.6 175.5 165.5 163.9 154.1 C140.3 131.5 114.0 113.0 95.2 100.6 C58.8 79.1 38.5 69.4 17.6 61.2 C8.2 57.4 8.2 57.4 2.2 56.6 Z" transform="translate(746,120)"/><path fill="#67D35E" d="M0 0 C1.1 0.1 2.2 0.2 3.4 0.4 C42 4.8 87.7 9.5 107.9 11.8 C160.8 17.6 210.5 23.1 229.8 25.1 C280.7 30.7 287.6 37.9 295.9 55.9 C308.9 85.7 323.1 113.5 374.8 150.1 C389.7 160.8 389.7 160.8 391.1 181.3 C391.2 198.6 391.1 229.9 385.1 289.8 C378.8 352.0 378.8 352.0 370.9 414.4 C366.8 448 362.8 479.5 361.9 494.1 C361.2 507.3 359.8 523.1 350.6 529.9 C343 535.3 335.7 535.5 326.6 534.9 C282.4 525.5 238 501.3 138.6 437.9 C72.5 393.3 25.6 345.2 -0.9 313.9 C-54.2 248.5 -75.4 182 -42.8 66.5 C-42.8 43.8 -42.8 36 -36.7 7.1 C-26.1 -3.0 -13.5 -1.5 0 0 Z M11.6 53.9 C23.1 133.0 50.3 208.3 99.6 271.9 C130.6 312.8 168.5 348.0 210.5 377.4 C239.1 397.3 263.6 411.9 311.6 424.9 C313.2 411.4 316.2 384.4 317.1 376.0 C323.1 323.4 330.6 267.5 336.5 213.7 C337.5 205.4 337.6 197.5 337.6 192.6 C335.3 189.7 332.6 187.5 329.5 185.9 C309.1 175.7 300.3 168.2 283.1 152.4 C272.6 142.6 263.6 127.6 248.6 87.9 C192 73.5 163.7 70.1 147.3 68.4 C101.5 63.5 55.7 58.6 11.6 53.9 Z" transform="translate(141,600)"/></svg>`;

    async function renderValuePanel(
      giveAssets: Array<{ assetid: string }>,
      recvAssets: Array<{ assetid: string }>,
      giveRgMap: Record<string, any>,
      recvRgMap: Record<string, any>,
    ): Promise<void> {
      const keyData = await fetchPricedbPrice("5021;6");
      const keyPriceRef = keyData?.metal ?? 0;

      const [giveVal, recvVal] = await Promise.all([
        sideValueInKeys(giveAssets, giveRgMap, keyPriceRef),
        sideValueInKeys(recvAssets, recvRgMap, keyPriceRef),
      ]);

      const fmtKeys = (v: { total: number }) => {
        const rounded = Math.max(0, Math.round(v.total * 100) / 100) || 0;
        return `${rounded} keys`;
      };

      const mkUnpricedSection = (names: string[], side: string) => {
        if (names.length === 0) return "";
        const items = names
          .map((n) => `<li style="margin:0;padding:1px 0;">${n}</li>`)
          .join("");
        return `
          <details style="margin-bottom:6px;">
            <summary style="cursor:pointer;color:#8f98a0;font-size:11px;user-select:none;list-style:none;outline:none;">
              ${side}: ${names.length} unpriced item${names.length > 1 ? "s" : ""} ▸
            </summary>
            <ul style="margin:4px 0 0 8px;padding:0;color:#8f98a0;font-size:11px;list-style:disc;">${items}</ul>
          </details>
        `;
      };

      const existing = document.getElementById("tf2trader-value-panel");
      if (existing) existing.remove();

      const panel = document.createElement("div");
      panel.id = "tf2trader-value-panel";
      panel.style.cssText = [
        "position:fixed",
        "bottom:20px",
        "right:20px",
        "background:#1d1d1d",
        "border:1px solid #3d3d3e",
        "border-radius:5px",
        "color:#c6d4df",
        "font-size:12px",
        "font-family:'Motiva Sans',Arial,sans-serif",
        "padding:12px 16px",
        "z-index:99999",
        "min-width:220px",
        "box-shadow:0 4px 16px rgba(0,0,0,0.7)",
        "line-height:1.5",
      ].join(";");

      const hasUnpriced =
        giveVal.unpricedNames.length > 0 || recvVal.unpricedNames.length > 0;

      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;font-weight:bold;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #3d3d3e;color:#67D35E;font-size:13px;">
          ${LOGO_SVG}
          Value Estimate
        </div>
        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px;">
          <span style="color:#8f98a0;">You give</span>
          <strong style="color:#fff;">${fmtKeys(giveVal)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:${hasUnpriced ? "10" : "8"}px;">
          <span style="color:#8f98a0;">You receive</span>
          <strong style="color:#fff;">${fmtKeys(recvVal)}</strong>
        </div>
        ${hasUnpriced ? `<div style="border-top:1px solid #3d3d3e;padding-top:8px;margin-bottom:6px;">${mkUnpricedSection(giveVal.unpricedNames, "Giving")}${mkUnpricedSection(recvVal.unpricedNames, "Receiving")}</div>` : ""}
        <div style="font-size:11px;color:#8f98a0;padding-top:6px;border-top:1px solid #3d3d3e;">
          via <a href="https://pricedb.io" target="_blank" rel="noopener" style="color:#67C1F5;text-decoration:none;">PriceDB.io</a>
        </div>
      `;

      document.body.appendChild(panel);
    }

    // Watches both trade-slot containers and refreshes the panel whenever items
    // are added or removed — works on any tradeoffer/new page.
    function startLiveValuePanel(): void {
      const win = window as any;
      let debounce: ReturnType<typeof setTimeout> | null = null;

      const refresh = async () => {
        const status = win.g_rgCurrentTradeStatus;
        if (!status) return;

        const myAssets = (status.me?.assets ?? []) as Array<{
          assetid: string;
        }>;
        const theirAssets = (status.them?.assets ?? []) as Array<{
          assetid: string;
        }>;

        if (myAssets.length === 0 && theirAssets.length === 0) {
          document.getElementById("tf2trader-value-panel")?.remove();
          return;
        }

        const myInv: Record<string, any> =
          win.UserYou?.rgContexts?.["440"]?.["2"]?.inventory?.rgInventory ?? {};
        const theirInv: Record<string, any> =
          win.UserThem?.rgContexts?.["440"]?.["2"]?.inventory?.rgInventory ??
          {};

        try {
          await renderValuePanel(myAssets, theirAssets, myInv, theirInv);
        } catch (e) {
          console.warn("[tf2-trader] Live value panel error:", e);
        }
      };

      const schedule = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(refresh, 600);
      };

      const observe = () => {
        const yours = document.getElementById("your_slots");
        const theirs = document.getElementById("their_slots");
        if (!yours || !theirs) {
          setTimeout(observe, 500);
          return;
        }
        const obs = new MutationObserver(schedule);
        obs.observe(yours, { childList: true, subtree: true });
        obs.observe(theirs, { childList: true, subtree: true });
      };
      observe();
    }

    // Start on every tradeoffer/new page — no listing params required.
    startLiveValuePanel();

    // Only run the auto-build flow when opened from a backpack.tf listing link.
    if (
      !params.has("listing_currencies_metal") &&
      !params.has("listing_currencies_keys")
    )
      return;

    const intent = params.get("listing_intent"); // "0" = buy order (give item, get currency), "1" = sell order (give currency, get item)
    const keysNeeded = parseFloat(params.get("listing_currencies_keys") || "0");
    const metalNeeded = parseFloat(
      params.get("listing_currencies_metal") || "0",
    );
    const forItem = params.get("for_item"); // "440_2_assetid" — item from partner's inventory
    const itemName = params.get("listing_item_name"); // for buy orders — name of item in our inventory

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    const waitFor = (ms: number) => new Promise((res) => setTimeout(res, ms));

    async function waitForGlobal<T>(
      getter: () => T | undefined,
      timeout = 15000,
    ): Promise<T> {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const val = getter();
        if (val !== undefined) return val;
        await waitFor(200);
      }
      throw new Error("Timeout waiting for Steam globals");
    }

    function throwError(msg: string): never {
      const itemLabel = itemName || forItem || "item";
      alert(`TF2 Trader: Could not build trade for "${itemLabel}": ${msg}`);
      throw new Error(msg);
    }

    // -------------------------------------------------------------------------
    // Inventory loading
    // -------------------------------------------------------------------------

    function nameFromDescription(desc: any): string {
      let name: string = desc.market_hash_name || desc.name || "";

      if (desc.descriptions) {
        for (const d of desc.descriptions) {
          if (!d.value) continue;
          if (d.value === "( Not Usable in Crafting )") {
            name = "Non-Craftable " + name;
          } else if (d.value.startsWith("\u2605 Unusual Effect: ")) {
            const effect = d.value.substring("\u2605 Unusual Effect: ".length);
            name = name.replace("Unusual", effect);
          }
        }
      }

      name = name
        .replace("\n", " ")
        .replace("Series #", "#")
        .replace(/ #\d+$/, "");

      return name;
    }

    async function fetchInventory(
      steamId: string,
    ): Promise<{ items: ParsedItem[]; rgMap: Record<string, SteamRgEntry> }> {
      const url = `https://steamcommunity.com/inventory/${steamId}/440/2?count=2000&l=english`;
      let body: any;

      try {
        const res = await fetch(url);
        if (!res.ok) throw res.status;
        body = await res.json();
      } catch (err) {
        throwError(`Could not fetch inventory: ${err}`);
      }

      const descMap: Record<string, any> = {};
      for (const desc of body.descriptions ?? []) {
        const key = `${desc.classid}_${desc.instanceid ?? "0"}`;
        descMap[key] = desc;
      }

      const items: ParsedItem[] = [];
      const rgMap: Record<string, SteamRgEntry> = {};

      for (const asset of body.assets ?? []) {
        const key = `${asset.classid}_${asset.instanceid ?? "0"}`;
        const desc = descMap[key] ?? {};
        const id = asset.assetid;
        items.push({ id, name: nameFromDescription(desc) });
        // Build a Steam-compatible rgInventory entry.
        // Steam's UpdateSlots accesses entry.rgItem — Steam sets this as a
        // self-reference (the merged entry IS the item description).
        const entry: SteamRgEntry = {
          ...desc,
          id,
          assetid: id,
          classid: asset.classid,
          instanceid: asset.instanceid ?? "0",
          amount: asset.amount ?? "1",
          appid: 440,
          contextid: "2",
        };
        // rgItem is a self-reference — Steam's UpdateSlots reads e.g.
        // entry.rgItem.market_hash_name, which resolves via entry.market_hash_name
        entry.rgItem = entry;
        rgMap[id] = entry;
      }

      return { items, rgMap };
    }

    async function loadBothInventories(): Promise<
      [
        ParsedItem[],
        ParsedItem[],
        Record<string, SteamRgEntry>,
        Record<string, SteamRgEntry>,
      ]
    > {
      const win = window as any;

      // Wait for Steam's global user objects
      const UserYou = await waitForGlobal<any>(() => win.UserYou);
      const UserThem = await waitForGlobal<any>(() => win.UserThem);
      const partnerSteamId: string =
        win.g_ulTradePartnerSteamID?.toString() ??
        (await waitForGlobal<string>(() =>
          win.g_ulTradePartnerSteamID?.toString(),
        ));

      const mySteamId: string = UserYou?.strSteamId;
      if (!mySteamId) throwError("Could not determine your Steam ID");
      if (!partnerSteamId) throwError("Could not determine partner Steam ID");

      const [mine, theirs] = await Promise.all([
        fetchInventory(mySteamId),
        fetchInventory(partnerSteamId),
      ]);
      return [mine.items, theirs.items, mine.rgMap, theirs.rgMap];
    }

    // -------------------------------------------------------------------------
    // Currency picking
    // -------------------------------------------------------------------------

    /**
     * Converts a refined metal float to ref/rec/scrap counts.
     * e.g. 1.33 ref = 1 ref, 1 rec (0.33), 0 scrap
     */
    function metalToComponents(metal: number): {
      ref: number;
      rec: number;
      scrap: number;
    } {
      const totalScrap = Math.round(metal * 9);
      const ref = Math.floor(totalScrap / 9);
      const remaining = totalScrap % 9;
      const rec = Math.floor(remaining / 3);
      const scrap = remaining % 3;
      return { ref, rec, scrap };
    }

    function pickCurrencyItems(
      inventory: ParsedItem[],
      keys: number,
      metal: number,
    ): ParsedItem[] {
      const invKeys = inventory.filter(
        (i) => i.name === "Mann Co. Supply Crate Key",
      );
      const invRef = inventory.filter((i) => i.name === "Refined Metal");
      const invRec = inventory.filter((i) => i.name === "Reclaimed Metal");
      const invScrap = inventory.filter((i) => i.name === "Scrap Metal");

      if (invKeys.length < keys) throwError("Insufficient Keys in inventory");

      const { ref, rec, scrap } = metalToComponents(metal);

      // Simple check — allow change using smaller denominations
      const totalAvailableScrap =
        invRef.length * 9 + invRec.length * 3 + invScrap.length;
      const totalNeededScrap = ref * 9 + rec * 3 + scrap;

      if (totalAvailableScrap < totalNeededScrap) {
        throwError("Insufficient metal in inventory");
      }

      let refNeeded = ref;
      let recNeeded = rec;
      let scrapNeeded = scrap;

      // Upgrade smaller denominations if needed
      if (scrapNeeded > invScrap.length) {
        const extra = scrapNeeded - invScrap.length;
        scrapNeeded = invScrap.length;
        recNeeded += Math.ceil(extra / 3);
        // change back
      }
      if (recNeeded > invRec.length) {
        const extra = recNeeded - invRec.length;
        recNeeded = invRec.length;
        refNeeded += Math.ceil(extra / 3);
      }
      if (refNeeded > invRef.length) {
        throwError("Insufficient Refined Metal in inventory");
      }

      const picked: ParsedItem[] = [
        ...invKeys.slice(0, keys),
        ...invRef.slice(0, refNeeded),
        ...invRec.slice(0, recNeeded),
        ...invScrap.slice(0, scrapNeeded),
      ];

      return picked;
    }

    // -------------------------------------------------------------------------
    // Main flow
    // -------------------------------------------------------------------------

    try {
      console.log("[tf2-trader] Starting. Params:", {
        intent,
        keysNeeded,
        metalNeeded,
        forItem,
        itemName,
      });

      // Give the page a moment to set up Steam globals
      await waitFor(500);

      console.log("[tf2-trader] Loading inventories...");
      const [myInventory, theirInventory, myRgMap, theirRgMap] =
        await loadBothInventories();
      console.log("[tf2-trader] My inventory:", myInventory.length, "items");
      console.log(
        "[tf2-trader] Their inventory:",
        theirInventory.length,
        "items",
      );

      const itemsToGive: ReturnType<typeof toTradeItem>[] = [];
      const itemsToReceive: ReturnType<typeof toTradeItem>[] = [];

      if (intent === "1") {
        // Sell listing — they are selling, we are buying their item
        let assetId: string | undefined;

        if (forItem) {
          // URL already has for_item=440_2_assetid (rare but handle it)
          assetId = forItem.split("_")[2];
          if (!assetId) throwError("Could not parse asset ID from for_item");
          console.log(
            "[tf2-trader] Sell listing — receiving assetId from for_item:",
            assetId,
          );
        } else if (itemName) {
          // No for_item — find the item by name in the partner's inventory
          const decodedName = decodeURIComponent(itemName);
          console.log(
            "[tf2-trader] Sell listing — looking for item in partner inventory:",
            decodedName,
          );
          const theirItem = theirInventory.find((i) => i.name === decodedName);
          if (!theirItem)
            throwError(
              `Could not find "${decodedName}" in partner's inventory`,
            );
          assetId = theirItem.id;
          console.log(
            "[tf2-trader] Sell listing — receiving assetId from name lookup:",
            assetId,
          );
        } else {
          throwError(
            "Missing for_item and listing_item_name — cannot identify item to receive",
          );
        }

        itemsToReceive.push(toTradeItem(assetId!));

        // Add our currency
        const currencyItems = pickCurrencyItems(
          myInventory,
          keysNeeded,
          metalNeeded,
        );
        console.log(
          "[tf2-trader] Currency items to give:",
          currencyItems.map((i) => i.name),
        );
        currencyItems.forEach((i) => itemsToGive.push(toTradeItem(i.id)));
      } else if (intent === "0") {
        // Buy listing — they are buying, we are selling our item + receiving currency
        if (!itemName) throwError("Missing listing_item_name parameter");

        const decodedName = decodeURIComponent(itemName);
        console.log(
          "[tf2-trader] Buy listing — looking for item:",
          decodedName,
        );
        const ourItem = myInventory.find((i) => i.name === decodedName);
        if (!ourItem)
          throwError(`Could not find "${decodedName}" in your inventory`);
        console.log("[tf2-trader] Found item to give:", ourItem);

        itemsToGive.push(toTradeItem(ourItem.id));

        // Add their currency
        const currencyItems = pickCurrencyItems(
          theirInventory,
          keysNeeded,
          metalNeeded,
        );
        console.log(
          "[tf2-trader] Currency items to receive:",
          currencyItems.map((i) => i.name),
        );
        currencyItems.forEach((i) => itemsToReceive.push(toTradeItem(i.id)));
      } else {
        throwError("Unknown listing_intent value");
      }

      console.log("[tf2-trader] itemsToGive:", itemsToGive);
      console.log("[tf2-trader] itemsToReceive:", itemsToReceive);

      const win2 = window as any;

      // Strip for_item from the URL — CSFloat's auto_fill.ts watches for this
      // param and tries to auto-send the trade with its own logic, causing a
      // 500 error. Removing it stops CSFloat from interfering.
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete("for_item");
      history.replaceState(null, "", cleanUrl.toString());

      console.log("[tf2-trader] Waiting for g_rgCurrentTradeStatus...");
      await waitForGlobal<any>(() => win2.g_rgCurrentTradeStatus?.me?.assets);
      console.log("[tf2-trader] g_rgCurrentTradeStatus ready");

      // Trigger Steam to load both inventories
      console.log("[tf2-trader] Triggering inventory loads...");
      const UserYou = await waitForGlobal<any>(() => win2.UserYou);
      const UserThem = await waitForGlobal<any>(() => win2.UserThem);
      const partnerSteamId = win2.g_ulTradePartnerSteamID?.toString();
      const mySteamId: string = UserYou.strSteamId;

      await waitForGlobal<any>(() =>
        UserYou.rgContexts?.["440"] ? true : undefined,
      );
      if (!UserYou.rgContexts?.["440"]?.["2"]?.inventory?.rgInventory) {
        UserYou.getInventory(440, 2);
      }

      UserThem.LoadForeignAppContextData(partnerSteamId, 440, 2);
      await waitForGlobal<any>(() =>
        UserThem.rgContexts?.["440"]?.["2"] ? true : undefined,
      );
      if (UserThem.cLoadsInFlight === 0) {
        UserThem.loadInventory(440, 2);
      }

      console.log("[tf2-trader] Waiting for Steam inventory caches...");
      await waitForGlobal<any>(() => {
        const youInv =
          UserYou.rgContexts?.["440"]?.["2"]?.inventory?.rgInventory;
        const themInv =
          UserThem.rgContexts?.["440"]?.["2"]?.inventory?.rgInventory;
        return youInv && themInv ? true : undefined;
      }, 30000);
      const youCache = UserYou.rgContexts["440"]["2"].inventory.rgInventory;
      const themCache = UserThem.rgContexts["440"]["2"].inventory.rgInventory;
      console.log(
        "[tf2-trader] Inventory caches ready:",
        Object.keys(youCache).length,
        "vs",
        Object.keys(themCache).length,
      );

      // -----------------------------------------------------------------------
      // Ensure every trade item has a DOM element.
      //
      // Steam's UpdateSlots calls user.findAssetElement(appid, contextid, id),
      // which resolves to document.getElementById('item_STEAMID_440_2_ASSETID').
      // Items not rendered in the inventory panel have no such element, causing
      // "Cannot read properties of undefined (reading 'rgItem')".
      //
      // For each missing element we:
      //   1. Try inventory.BuildItemElement(item) — creates a proper Steam element
      //   2. Fall back to a minimal <div> with rgItem set manually
      //
      // We also inject missing assetids into the rgInventory caches so Steam's
      // item-description lookups inside BuildItemElement work.
      // -----------------------------------------------------------------------

      // Off-screen container for item elements that Steam hasn't rendered yet.
      // We must NOT use display:none on the elements themselves — Steam's
      // PutItemInSlot moves them into the trade slot without changing display,
      // so a hidden element stays invisible in the slot (blank box).
      let offscreenContainer = document.getElementById(
        "tf2trader-items",
      ) as HTMLElement | null;
      if (!offscreenContainer) {
        offscreenContainer = document.createElement("div");
        offscreenContainer.id = "tf2trader-items";
        offscreenContainer.style.cssText =
          "position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;pointer-events:none;";
        document.body.appendChild(offscreenContainer);
      }

      function ensureItemElement(
        user: any,
        steamId: string,
        cache: Record<string, any>,
        rgMap: Record<string, SteamRgEntry>,
        assetid: string,
      ) {
        // Inject into rgInventory if missing — use the actual rgMap object,
        // not a copy, so any property writes (like .element) persist in cache
        if (!cache[assetid]) {
          if (!rgMap[assetid]) {
            console.warn(`[tf2-trader] No data for assetid ${assetid}`);
            return;
          }
          cache[assetid] = rgMap[assetid];
        }

        const itemData = cache[assetid];
        const elId = `item_${steamId}_440_2_${assetid}`;

        // If there's already a DOM element (Steam rendered it in the inventory
        // panel), nothing to do — it'll be found by getElementById.
        if (document.getElementById(elId)) return;

        // Prepare itemData fields Steam expects on rgInventory entries
        if (!itemData.homeElement) itemData.homeElement = offscreenContainer;
        if (!itemData.rgItem) itemData.rgItem = itemData;
        itemData.id = assetid;
        itemData.appid = 440;
        itemData.contextid = "2";
        itemData.unknown = false;
        if (itemData.is_stackable === undefined) itemData.is_stackable = false;

        // Try Steam's BuildItemElement — produces a properly styled item card
        try {
          const inv = user.getInventory?.(440, 2);
          if (inv?.BuildItemElement) {
            const el = inv.BuildItemElement(itemData);
            if (el) {
              if (el.id !== elId) el.id = elId;
              // Place in off-screen container (NOT display:none) so it's
              // visible when Steam moves it into the trade slot
              offscreenContainer!.appendChild(el);
              if (!itemData.element) itemData.element = el;
              console.log(`[tf2-trader] BuildItemElement created: ${elId}`);
              return;
            }
          }
        } catch (e) {
          console.warn(
            `[tf2-trader] BuildItemElement failed for ${assetid}:`,
            e,
          );
        }

        // Manual fallback — bare div, still in off-screen container not hidden
        const el = document.createElement("div");
        el.id = elId;
        (el as any).rgItem = itemData;
        itemData.element = el;
        offscreenContainer!.appendChild(el);
        console.log(`[tf2-trader] Manual element created: ${elId}`);
      }

      for (const a of itemsToGive) {
        ensureItemElement(UserYou, mySteamId, youCache, myRgMap, a.assetid);
      }
      for (const a of itemsToReceive) {
        ensureItemElement(
          UserThem,
          partnerSteamId,
          themCache,
          theirRgMap,
          a.assetid,
        );
      }

      // Populate the trade via g_rgCurrentTradeStatus + RefreshTradeStatus.
      // rgInventory is populated and DOM elements exist for all trade items.
      win2.g_rgCurrentTradeStatus.me.assets.length = 0;
      win2.g_rgCurrentTradeStatus.them.assets.length = 0;

      for (const a of itemsToGive) {
        win2.g_rgCurrentTradeStatus.me.assets.push({
          appid: String(a.appid),
          contextid: a.contextid,
          amount: String(a.amount),
          assetid: a.assetid,
          id: a.assetid,
        });
      }
      for (const a of itemsToReceive) {
        win2.g_rgCurrentTradeStatus.them.assets.push({
          appid: String(a.appid),
          contextid: a.contextid,
          amount: String(a.amount),
          assetid: a.assetid,
          id: a.assetid,
        });
      }

      console.log("[tf2-trader] Calling RefreshTradeStatus...");
      win2.RefreshTradeStatus(win2.g_rgCurrentTradeStatus, true);
      console.log(
        "[tf2-trader] Done — review trade and click Send Trade Offer.",
      );
      // The live panel observer (startLiveValuePanel) will pick up the new
      // trade items automatically now that RefreshTradeStatus has run.
    } catch (err) {
      // Errors are already alerted via throwError; just log non-thrown cases
      console.error("[tf2-trader] tradeoffer-new error:", err);
    }
  },
});
