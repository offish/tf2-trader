import { renderValuePanel, startLiveValuePanel } from "@/utils/trade-panel";

export default defineContentScript({
  matches: ["https://steamcommunity.com/tradeoffer/new*"],
  world: "MAIN",
  runAt: "document_idle",
  async main() {
    const params = new URLSearchParams(location.search);

    function toTradeItem(assetId: string) {
      return { appid: 440, contextid: "2", amount: 1, assetid: assetId };
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

    interface ParsedItem {
      id: string;
      name: string;
    }

    // Steam rgInventory entry — merged asset + description, same shape Steam's
    // loadInventory produces so it can be injected when an item is missing.
    interface SteamRgEntry {
      id: string;
      assetid: string;
      classid: string;
      instanceid: string;
      amount: string;
      appid: number;
      contextid: string;
      [key: string]: any;
    }

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
      console.log("[tf2-trader] Done — review trade and click Send Trade Offer.");
      // The live panel observer (startLiveValuePanel) will pick up the new
      // trade items automatically now that RefreshTradeStatus has run.
    } catch (err) {
      // Errors are already alerted via throwError; just log non-thrown cases
      console.error("[tf2-trader] tradeoffer-new error:", err);
    }
  },
});
