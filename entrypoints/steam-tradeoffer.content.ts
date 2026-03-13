import "@/styles/steam-tradeoffer.css";
import {
  addAttributes,
  getURLParams,
  flatten,
  getIDsFromString,
  execHotKey,
  groupBy,
  partition,
} from "@/utils/tradeoffer";
import { getEffectURL } from "@/utils";
import { SteamItem } from "@/types";

const W = window as any;

export default defineContentScript({
  matches: ["*://steamcommunity.com/tradeoffer/*"],
  world: "MAIN",
  runAt: "document_end",
  main() {
    waitForSteamGlobals(() => {
      try {
        initEnhancer();
      } catch (err) {
        console.error("[Steam Trade Enhancer] init error:", err);
      }
    });
  },
});

function waitForSteamGlobals(cb: () => void, attempts = 0): void {
  if (W.UserYou && W.UserThem && W.g_rgCurrentTradeStatus) {
    cb();
  } else if (attempts < 60) {
    setTimeout(() => waitForSteamGlobals(cb, attempts + 1), 500);
  } else {
    console.warn("[Steam Trade Enhancer] Steam globals never appeared.");
  }
}

function initEnhancer(): void {
  const urlParams = getURLParams();
  const UserYou = W.UserYou;
  const UserThem = W.UserThem;
  const STEAMID: string = UserYou.strSteamId;
  const PARTNER_STEAMID: string = UserThem.strSteamId;
  const INVENTORY = W.g_rgAppContextData;
  const PARTNER_INVENTORY = W.g_rgPartnerAppContextData;
  const TRADE_STATUS = W.g_rgCurrentTradeStatus;

  const page = {
    $document: document,
    $body: document.body,
    $yourSlots: document.getElementById("your_slots")!,
    $theirSlots: document.getElementById("their_slots")!,
    $inventories: document.getElementById("inventories")!,
    $inventoryBox: document.getElementById("inventory_box")!,
    $inventoryDisplayControls: document.getElementById(
      "inventory_displaycontrols",
    )!,
    $inventorySelectYour: document.getElementById(
      "inventory_select_your_inventory",
    )!,
    $inventorySelectTheir: document.getElementById(
      "inventory_select_their_inventory",
    )!,
    $tradeBoxContents: document.querySelector<HTMLElement>(
      "#inventory_box div.trade_box_contents",
    )!,
    $appSelectOptions: Array.from(
      document.querySelectorAll<HTMLElement>(".appselect_options .option"),
    ),
    get $inventory() {
      return (
        document.querySelector<HTMLElement>(
          '.inventory_ctn:not([style*="display: none"])',
        ) ?? null
      );
    },
    get $activeInventoryTab() {
      return (
        document.querySelector<HTMLElement>(".inventory_user_tab.active") ??
        null
      );
    },
    get $modifyTradeOffer() {
      return (
        document.querySelector<HTMLElement>(
          'div.modify_trade_offer:not([style*="display: none"])',
        ) ?? null
      );
    },
    get $appSelectImg() {
      return (
        document.querySelector<HTMLImageElement>("#appselect_activeapp img") ??
        null
      );
    },
    get $deadItem() {
      return (
        document.querySelector<HTMLElement>('a[href$="_undefined"]') ?? null
      );
    },
    get $changeOfferButton() {
      return (
        document.querySelector<HTMLElement>(
          "#modify_trade_offer_opts div.content",
        ) ?? null
      );
    },
    $offerSummary: null as HTMLElement | null,
    $yourSummary: null as HTMLElement | null,
    $theirSummary: null as HTMLElement | null,
    $controls: null as HTMLElement | null,
    controls: {
      $amount: null as HTMLInputElement | null,
      $index: null as HTMLInputElement | null,
      $ids: null as HTMLInputElement | null,
    },
    fields: {
      $ids: null as HTMLElement | null,
    },
    btns: {
      $clearMy: null as HTMLElement | null,
      $clearTheir: null as HTMLElement | null,
      $items: null as HTMLElement | null,
      $keys: null as HTMLElement | null,
      $metal: null as HTMLElement | null,
      $recent: null as HTMLElement | null,
      $listing: null as HTMLElement | null,
      $addIDs: null as HTMLElement | null,
      $getIDs: null as HTMLElement | null,
    },
  };

  const stored = {
    id_visible: "getTradeOfferWindow.id_visible",
  };

  const inventoryManager = (() => {
    const users: Record<
      string,
      Array<(steamid: string, appid: string, contextid: string) => void>
    > = {};
    const inventories: Record<
      string,
      Record<
        string,
        Record<
          string,
          Array<(steamid: string, appid: string, contextid: string) => void>
        >
      >
    > = {};

    users[STEAMID] = [];
    users[PARTNER_STEAMID] = [];
    inventories[STEAMID] = {};
    inventories[PARTNER_STEAMID] = {};

    function call(steamid: string, appid: string, contextid: string) {
      const actions = [
        ...(users[steamid] || []),
        ...(inventories[steamid]?.[appid]?.[contextid] || []),
      ];
      users[steamid] = [];
      if (inventories[steamid]?.[appid]) inventories[steamid][appid] = {};
      actions.forEach((fn) => fn(steamid, appid, contextid));
    }

    function register(
      steamid: string,
      appidOrFn: string | ((s: string, a: string, c: string) => void),
      contextidOrFn?: string | ((s: string, a: string, c: string) => void),
      fn?: (s: string, a: string, c: string) => void,
    ) {
      if (typeof appidOrFn === "function") {
        users[steamid].push(appidOrFn);
      } else if (fn && typeof contextidOrFn === "string") {
        if (!inventories[steamid][appidOrFn])
          inventories[steamid][appidOrFn] = {};
        if (!inventories[steamid][appidOrFn][contextidOrFn])
          inventories[steamid][appidOrFn][contextidOrFn] = [];
        inventories[steamid][appidOrFn][contextidOrFn].push(fn);
      }
    }

    function registerForUser(
      steamid: string,
      fn: (s: string, a: string, c: string) => void,
    ) {
      users[steamid].push(fn);
    }

    return { register, registerForUser, call };
  })();

  function getInventory(
    appid: string,
    contextid: string,
    isYou: boolean,
  ): Record<string, SteamItem> {
    const user = isYou ? UserYou : UserThem;
    return (
      user.rgAppInfo?.[appid]?.rgContexts[contextid]?.inventory?.rgInventory ||
      {}
    );
  }

  function getInventoryContext(): { appid?: string; contextid?: string } {
    const inv = page.$inventory;
    const match = (inv?.getAttribute("id") || "").match(/(\d+)_(\d+)$/);
    if (!match) return {};
    return { appid: match[1], contextid: match[2] };
  }

  function customizeItems(
    inventory: Record<string, SteamItem & { element?: HTMLElement }>,
  ) {
    for (const assetid in inventory) {
      const item = inventory[assetid];
      if (item.element) addAttributes(item, item.element);
    }
  }

  interface GetItemsResult {
    items: HTMLElement[];
    satisfied: boolean;
  }

  const collectItems = (() => {
    const identifiers = {
      isKey(item: SteamItem): boolean | null {
        switch (parseInt(String(item.appid))) {
          case 440:
            return item.market_hash_name === "Mann Co. Supply Crate Key";
          case 730:
            return identifiers.hasTag(item, "Type", "Key");
        }
        return null;
      },
      hasTag(
        item: SteamItem,
        tagName: string,
        tagValue: string,
      ): boolean | null {
        if (!item.tags) return null;
        for (const tag of item.tags as Array<{
          category: string;
          name: string;
        }>) {
          if (tag.category === tagName && tagValue === tag.name) return true;
        }
        return null;
      },
    };

    const finders = {
      metal(
        isYou: boolean,
        amount: number,
        index: number,
        name: string,
      ): SteamItem[] {
        return (
          pickItems(
            isYou,
            amount,
            index,
            (item) => item.appid == 440 && item.market_hash_name === name,
          ) || []
        );
      },
      id(ids: string[]): HTMLElement[] {
        const filter = (item: SteamItem) =>
          ids.includes(String((item as any).id));
        const items = (pickItems(null, ids.length, 0, filter) || []).sort(
          (a, b) =>
            ids.indexOf(String((a as any).id)) -
            ids.indexOf(String((b as any).id)),
        );
        return getElementsForItems(items);
      },
    };

    function pickItems(
      isYou: boolean | null,
      amount: number,
      index: number,
      filter: (item: SteamItem) => boolean | null,
    ): SteamItem[] {
      const { appid, contextid } = getInventoryContext();
      if (!appid || !contextid) return [];

      function getItemsForSide(forYou: boolean): SteamItem[] {
        const $slotItems = Array.from(
          (forYou
            ? page.$yourSlots
            : page.$theirSlots
          ).querySelectorAll<HTMLElement>(".item"),
        );
        const inventory = getInventory(appid!, contextid!, forYou);
        const addedIDs = $slotItems.reduce((arr: string[], el) => {
          const item = (el as any).rgItem;
          if (item?.appid == appid) arr.push(String(item.id));
          return arr;
        }, []);

        const ids = Object.keys(inventory);
        let localIndex = index;
        if (localIndex < 0) {
          localIndex = (localIndex + 1) * -1;
          ids.reverse();
        }

        const total: SteamItem[] = [];
        let items: SteamItem[] = [];
        let currentIndex = 0;

        for (const id of ids) {
          const item = inventory[id];
          if (addedIDs.includes(id)) {
            if (localIndex !== 0 && filter(item)) currentIndex++;
            continue;
          }
          if (items.length >= amount) break;
          if (filter(item)) {
            if (currentIndex >= localIndex) items.push(item);
            total.push(item);
            currentIndex++;
          }
        }

        if (items.length < amount) {
          items = total.splice(
            offsetIndex(localIndex, amount, total.length),
            amount,
          );
        }
        return items;
      }

      if (isYou === null) return flatten([true, false].map(getItemsForSide));
      return getItemsForSide(isYou);
    }

    function offsetIndex(
      index: number,
      amount: number,
      length: number,
    ): number {
      if (index < 0) return Math.max(0, length - (amount + index + 1));
      if (index + amount >= length) return Math.max(0, length - amount);
      return index;
    }

    function getElementsForItems(items: SteamItem[]): HTMLElement[] {
      return items
        .map((item) =>
          document.getElementById(
            `item${item.appid}_${item.contextid}_${(item as any).id}`,
          ),
        )
        .filter((el): el is HTMLElement => el !== null);
    }

    function getItemsForMetal(
      isYou: boolean | null,
      amount: number,
      index: number,
    ): GetItemsResult {
      const toScrap = (num: number) => Math.round(num / (1 / 9));
      const amountScrap = toScrap(amount);
      let total = 0;
      const valueMet = () => total === amountScrap;
      const values: Record<string, number> = {
        "Refined Metal": 9,
        "Reclaimed Metal": 3,
        "Scrap Metal": 1,
      };

      function getMetal(arr: SteamItem[], type: string): SteamItem[] {
        if (valueMet()) return arr;
        const curValue = values[type];
        const amountToAdd = Math.floor((amountScrap - total) / curValue);
        const found = finders.metal(isYou as boolean, amountToAdd, index, type);
        total += Math.min(amountToAdd, found.length) * curValue;
        return arr.concat(found);
      }

      const metal = Object.keys(values).reduce(getMetal, [] as SteamItem[]);
      return { items: getElementsForItems(metal), satisfied: valueMet() };
    }

    function getItems(
      mode: string,
      amount: number,
      index: number | string[],
      isYou: boolean | null,
    ): GetItemsResult {
      switch (mode) {
        case "KEYS": {
          const found = pickItems(
            isYou,
            amount,
            index as number,
            identifiers.isKey,
          );
          const items = getElementsForItems(found);
          return { items, satisfied: amount === items.length };
        }
        case "METAL":
          return getItemsForMetal(isYou, amount, index as number);
        case "ID": {
          const ids = index as string[];
          const items = finders.id(ids);
          return { items, satisfied: ids.length === items.length };
        }
        case "RECENT": {
          const getNearNumbers = (
            nums: number[],
            near: number,
            gap: number,
          ): number[] => {
            if (!nums.length) return [];
            const sorted = nums
              .map((num) => ({ num, distance: Math.abs(num - near) }))
              .sort((a, b) => a.distance - b.distance);
            if (sorted[0].distance > gap) return [];
            const out = [sorted[0].num];
            for (let i = 1; i < sorted.length; i++) {
              if (Math.abs(sorted[i - 1].distance - sorted[i].distance) > gap)
                break;
              out.push(sorted[i].num);
            }
            return out;
          };
          const isVisible = (el: HTMLElement) =>
            el.parentElement?.style.display !== "none";
          let found = Array.from(
            page.$inventory?.querySelectorAll<HTMLElement>("div.item") || [],
          ).filter(isVisible);
          let localIndex = index as number;
          if (localIndex < 0) {
            localIndex = (localIndex + 1) * -1;
            found = found.reverse();
          }
          const { appid } = getInventoryContext();
          const addedIDs = Array.from(
            (isYou
              ? page.$yourSlots
              : page.$theirSlots
            ).querySelectorAll<HTMLElement>(".item"),
          ).reduce((arr: string[], el) => {
            const rgItem = (el as any).rgItem;
            if (rgItem?.appid == appid) arr.push(String(rgItem.id));
            return arr;
          }, []);
          const getItemIdFromEl = (el: HTMLElement) => el.id.split("_")[2];
          const ids = found
            .map((el) => parseInt(getItemIdFromEl(el)))
            .filter((id) => !addedIDs.includes(String(id)));
          const nearIds = getNearNumbers(ids, Math.max(0, ...ids), 100).map(
            String,
          );
          const nearSet = new Set(nearIds);
          const filteredFound = found.filter((el) =>
            nearSet.has(getItemIdFromEl(el)),
          );
          return {
            items: filteredFound,
            satisfied: nearIds.length === filteredFound.length,
          };
        }
        case "ITEMS": {
          let found = Array.from(
            page.$inventory?.querySelectorAll<HTMLElement>("div.item") || [],
          ).filter((el) => el.parentElement?.style.display !== "none");
          let localIndex = index as number;
          if (localIndex < 0) {
            localIndex = (localIndex + 1) * -1;
            found = found.reverse();
          }
          const offset = offsetIndex(localIndex, amount, found.length);
          const items = found.splice(offset, amount);
          return { items, satisfied: amount === items.length };
        }
        default:
          throw new Error(`Unknown mode: ${mode}`);
      }
    }

    return getItems;
  })();

  const tradeOfferWindow = (() => {
    function dumpSummary(
      type: string,
      itemsList: HTMLElement[],
      isYou: boolean,
      User: any,
    ): string {
      const inventory = isYou ? INVENTORY : PARTNER_INVENTORY;
      const apps: Record<string, string[]> = {};
      const items: Record<string, number> = {};
      let total = 0;

      for (const itemEl of itemsList) {
        const split = itemEl
          .getAttribute("id")!
          .replace(/^item/, "")
          .split("_");
        const [appid, contextid, assetid] = split;
        const img = itemEl.querySelector("img")?.getAttribute("src") || "";
        const borderColor = itemEl.style.borderColor;
        const effect = itemEl.getAttribute("data-effect") || "";
        const uncraft = itemEl.classList.contains("uncraft");
        const strange = itemEl.classList.contains("strange");
        const item =
          inventory[appid]?.rgContexts[contextid]?.inventory?.rgInventory[
            assetid
          ];
        if (!item) return "";
        const key = `${img}\n${borderColor}\n${effect}\n${uncraft ? "1" : ""}\n${strange ? "1" : ""}`;
        items[key] = (items[key] || 0) + 1;
        if (!apps[appid]) apps[appid] = [];
        apps[appid].push(assetid);
        total++;
      }

      if (total === 0) return "";

      const ids = apps["440"];
      const itemsStr = total === 1 ? "item" : "items";
      let html = `<div class="summary_header">${type} summary (${total} ${itemsStr}):</div>`;

      if (ids) {
        const url = `https://backpack.tf/profiles/${User.strSteamId}?select=${ids.join(",")}`;
        html += `<a title="Open on backpack.tf" href="${url}" target="_blank">`;
      }

      for (const key in items) {
        const [img, borderColor, effect, uncraftStr, strangeStr] =
          key.split("\n");
        const count = items[key];
        let backgroundImages = `url(${img})`;
        let classes = "summary_item";
        if (effect && effect !== "none")
          backgroundImages += `, url('${getEffectURL(effect)}')`;
        if (uncraftStr === "1") classes += " uncraft";
        if (strangeStr === "1") classes += " strange";
        const badge =
          count > 1 ? `<span class="summary_badge">${count}</span>` : "&nbsp;";
        html += `<span class="${classes}" style="background-image: ${backgroundImages}; border-color: ${borderColor};">${badge}</span>`;
      }

      if (ids) html += "</a>";
      return html;
    }

    function summarize(isYou: boolean) {
      const slots = isYou ? page.$yourSlots : page.$theirSlots;
      const container = isYou ? page.$yourSummary : page.$theirSummary;
      if (!slots || !container) return;
      container.innerHTML = dumpSummary(
        isYou ? "My" : "Their",
        Array.from(slots.querySelectorAll<HTMLElement>("div.item")),
        isYou,
        isYou ? UserYou : UserThem,
      );
    }

    function clearItemsInOffer(addedItemsEl: HTMLElement) {
      const items = Array.from(
        addedItemsEl.querySelectorAll<HTMLElement>("div.item"),
      ).reverse();
      W.GTradeStateManager.RemoveItemsFromTrade(items);
    }

    function addItemsByElements(itemsList: HTMLElement[]) {
      if (W.Economy_UseResponsiveLayout?.() && W.ResponsiveTrade_SwitchMode)
        W.ResponsiveTrade_SwitchMode(0);

      const slotsCache: Record<
        string,
        Record<string, Record<string, number>>
      > = {};

      for (const elItem of itemsList) {
        if (W.BIsInTradeSlot(elItem)) continue;
        const item = (elItem as any).rgItem;
        if (item.is_stackable) continue;

        const is_currency = false;
        const userslots = item.is_their_item
          ? W.g_rgCurrentTradeStatus.them
          : W.g_rgCurrentTradeStatus.me;
        const slots = userslots.assets;
        const cacheKey = (item.is_their_item ? "them" : "me") + "_asset";

        if (!slotsCache[cacheKey]) {
          slotsCache[cacheKey] = {
            slot: slots.reduce(
              (acc: Record<string, number>, slot: any, i: number) => {
                acc[
                  `${slot.appid}_${slot.contextid}_${slot.id ?? slot.assetid}`
                ] = i;
                return acc;
              },
              {},
            ),
          };
        }

        const key = `${item.appid}_${item.contextid}_${item.id}`;
        const iExisting = slotsCache[cacheKey].slot[key];
        let bChanged = false;

        if (iExisting !== undefined) {
          if (slots[iExisting].amount !== 1) {
            slots[iExisting].amount = 1;
            bChanged = true;
          }
        } else {
          slots.push({
            appid: item.appid,
            contextid: item.contextid,
            assetid: item.id,
            amount: 1,
          });
          slotsCache[cacheKey].slot[key] = slots.length - 1;
          bChanged = true;
        }

        if (bChanged) W.GTradeStateManager.m_bChangesMade = true;
      }

      W.g_rgCurrentTradeStatus.version++;
      W.RefreshTradeStatus(W.g_rgCurrentTradeStatus);
    }

    function updateDisplay(isYou: boolean, appid: string | number) {
      const show = (btn: HTMLElement | null, visible: boolean) => {
        if (btn) btn.style.display = visible ? "" : "none";
      };
      const isTF2 = appid == 440;
      const isCSGO = appid == 730;
      const li = urlParams.listing_intent;
      show(page.btns.$items, true);
      show(page.btns.$keys, isTF2 || isCSGO);
      show(page.btns.$metal, isTF2);
      show(
        page.btns.$listing,
        Boolean(isTF2 && ((isYou && li == "1") || (!isYou && li == "0"))),
      );
    }

    function userChanged(inventoryTab: HTMLElement | null) {
      if (!inventoryTab) return;
      const inv = page.$inventory;
      const isYou =
        inventoryTab.getAttribute("id") === "inventory_select_your_inventory";
      const match = (inv?.getAttribute("id") || "").match(/(\d+)_(\d+)$/);
      const appid =
        match?.[1] ||
        (() => {
          const src = page.$appSelectImg?.getAttribute("src") || "";
          return src.match(/public\/images\/apps\/(\d+)/)?.[1] || "";
        })();
      updateDisplay(isYou, appid);
    }

    return {
      summarize,
      addItemsByElements,
      clear: clearItemsInOffer,
      updateDisplay,
      userChanged,
    };
  })();

  if (!page.$tradeBoxContents) {
    console.warn(
      "[Steam Trade Enhancer] Could not find trade_box_contents element.",
    );
    return;
  }

  page.$tradeBoxContents.insertAdjacentHTML(
    "beforeend",
    `
    <div id="controls">
      <div class="trade_rule selectableNone"></div>
      <div class="selectableNone">Add multiple items:</div>
      <div class="filter_ctn">
        <input id="amount_control" class="filter_search_box" type="number" min="0" step="any" placeholder="amount"/>
        <input id="index_control"  class="filter_search_box" type="number" min="0" placeholder="index"/>
      </div>
      <div id="add_btns" class="control_fields">
        <div id="btn_additems"   class="btn_black btn_small"><span>Add</span></div>
        <div id="btn_addkeys"    class="btn_green btn_black btn_small"><span>Add Keys</span></div>
        <div id="btn_addmetal"   class="btn_silver btn_black btn_small"><span>Add Metal</span></div>
        <div id="btn_addrecent"  class="btn_silver btn_black btn_small"><span>Add Recent</span></div>
        <div id="btn_addlisting" class="btn_blue btn_black btn_small"><span>Add Listing</span></div>
      </div>
      <div id="clear_btns" class="control_fields">
        <div id="btn_clearmyitems"    class="btn_black btn_small"><span>Clear my items</span></div>
        <div id="btn_cleartheiritems" class="btn_black btn_small"><span>Clear their items</span></div>
      </div>
      <div id="id_fields" class="control_fields" style="display: none;">
        <div class="filter_ctn">
          <div class="filter_control_ctn">
            <input id="ids_control" class="filter_search_box filter_full" type="text" placeholder="ids" autocomplete="off"/>
          </div>
          <div class="filter_tag_button_ctn filter_right_controls">
            <div id="btn_addids" class="btn_black btn_small"><span>Add</span></div>
            <div id="btn_getids" class="btn_black btn_small"><span>Get</span></div>
          </div>
          <div style="clear:both;"></div>
        </div>
      </div>
    </div>
    <div id="tradeoffer_items_summary">
      <div class="items_summary" id="your_summary"></div>
      <div class="items_summary" id="their_summary"></div>
    </div>
  `,
  );

  const clearDiv = document.createElement("div");
  clearDiv.style.clear = "both";
  page.$inventories.insertAdjacentElement("afterend", clearDiv);

  page.$offerSummary = document.getElementById("tradeoffer_items_summary");
  page.$yourSummary = document.getElementById("your_summary");
  page.$theirSummary = document.getElementById("their_summary");
  page.$controls = document.getElementById("controls");
  page.controls.$amount = document.getElementById(
    "amount_control",
  ) as HTMLInputElement;
  page.controls.$index = document.getElementById(
    "index_control",
  ) as HTMLInputElement;
  page.controls.$ids = document.getElementById(
    "ids_control",
  ) as HTMLInputElement;
  page.fields.$ids = document.getElementById("id_fields");
  page.btns.$clearMy = document.getElementById("btn_clearmyitems");
  page.btns.$clearTheir = document.getElementById("btn_cleartheiritems");
  page.btns.$items = document.getElementById("btn_additems");
  page.btns.$keys = document.getElementById("btn_addkeys");
  page.btns.$metal = document.getElementById("btn_addmetal");
  page.btns.$recent = document.getElementById("btn_addrecent");
  page.btns.$listing = document.getElementById("btn_addlisting");
  page.btns.$addIDs = document.getElementById("btn_addids");
  page.btns.$getIDs = document.getElementById("btn_getids");

  function getDefaults(): [number, number, boolean] {
    return [
      parseFloat(page.controls.$amount?.value || "") || 1,
      parseInt(page.controls.$index?.value || "") || 0,
      page.$inventorySelectYour?.classList.contains("active") ?? true,
    ];
  }

  function addItems(
    mode = "ITEMS",
    amount = 1,
    index: number | string[] = 0,
    isYou: boolean | null = true,
  ): boolean | null {
    const inv = page.$inventory;
    const canModify = Boolean(
      (/(\d+)_(\d+)$/.test(inv?.getAttribute("id") || "") ||
        !page.$modifyTradeOffer) &&
      !page.$changeOfferButton,
    );
    if (!canModify) return null;
    const { items, satisfied } = collectItems(mode, amount, index, isYou);
    tradeOfferWindow.addItemsByElements(items);
    return satisfied;
  }

  function addIDs(idsStr: string) {
    const ids = getIDsFromString(idsStr);
    if (ids) addItems("ID", 0, ids, null);
  }

  async function addListingPrice() {
    const li = urlParams.listing_intent;
    const isYou = li == "1";
    const reasons: string[] = [];
    const currencies: Record<string, number> = {
      KEYS: parseInt(urlParams.listing_currencies_keys || "0") || 0,
      METAL: parseFloat(urlParams.listing_currencies_metal || "0") || 0,
    };
    const idx = parseInt(page.controls.$index?.value || "") || 0;
    for (const [currency, amount] of Object.entries(currencies)) {
      if (amount > 0 && addItems(currency, amount, idx, isYou) === false) {
        reasons.push(`not enough ${currency.toLowerCase()}`);
      }
    }
    if (reasons.length)
      alert(`Listing value could not be met: ${reasons.join(" and ")}`);
  }

  function toggleIDFields() {
    const el = page.fields.$ids;
    if (!el) return;
    const isHidden = el.style.display === "none";
    el.style.display = isHidden ? "" : "none";
    setStored(stored.id_visible, isHidden ? 1 : 0);
  }

  function getIDs(): string[] {
    const isYou =
      page.$activeInventoryTab?.getAttribute("id") ===
      "inventory_select_your_inventory";
    const slots = isYou ? page.$yourSlots : page.$theirSlots;
    return Array.from(slots.querySelectorAll<HTMLElement>("div.item")).map(
      (el) => String((el as any).rgItem?.id || ""),
    );
  }

  page.btns.$clearMy?.addEventListener("click", () =>
    tradeOfferWindow.clear(page.$yourSlots),
  );
  page.btns.$clearTheir?.addEventListener("click", () =>
    tradeOfferWindow.clear(page.$theirSlots),
  );
  page.btns.$items?.addEventListener("click", () =>
    addItems("ITEMS", ...getDefaults()),
  );
  page.btns.$keys?.addEventListener("click", () =>
    addItems("KEYS", ...getDefaults()),
  );
  page.btns.$metal?.addEventListener("click", () =>
    addItems("METAL", ...getDefaults()),
  );
  page.btns.$recent?.addEventListener("click", () =>
    addItems("RECENT", ...getDefaults()),
  );
  page.btns.$listing?.addEventListener("click", () => addListingPrice());
  page.btns.$addIDs?.addEventListener("click", () =>
    addIDs(page.controls.$ids?.value || ""),
  );
  page.btns.$getIDs?.addEventListener("click", () => {
    if (page.controls.$ids) page.controls.$ids.value = getIDs().join(",");
  });

  page.$appSelectOptions.forEach((el) => {
    el.addEventListener("click", () => {
      const match = (el.getAttribute("id") || "").match(
        /appselect_option_(you|them)_(\d+)_(\d+)/,
      );
      if (match) tradeOfferWindow.updateDisplay(match[1] === "you", match[2]);
    });
  });

  page.$inventorySelectYour?.addEventListener("click", () =>
    tradeOfferWindow.userChanged(page.$inventorySelectYour),
  );
  page.$inventorySelectTheir?.addEventListener("click", () =>
    tradeOfferWindow.userChanged(page.$inventorySelectTheir),
  );
  document.addEventListener("keypress", (e: KeyboardEvent) =>
    execHotKey(e, { 112: toggleIDFields }),
  );

  function forceInventory(appid: string, contextid: string) {
    TRADE_STATUS.them.assets.push({
      appid,
      contextid,
      assetid: "0",
      amount: 1,
    });
    try {
      W.RefreshTradeStatus(TRADE_STATUS, true);
    } catch {
      /* ignore */
    }
    TRADE_STATUS.them.assets = [];
    try {
      W.RefreshTradeStatus(TRADE_STATUS, true);
    } catch {
      /* ignore */
    }
  }

  function forceVisibility() {
    const active = page.$activeInventoryTab;
    page.$inventorySelectTheir?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    active?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  function customizeElements(
    steamid: string,
    appid: string,
    contextid: string,
  ) {
    const isYou = steamid === STEAMID;
    const inventory = isYou ? INVENTORY : PARTNER_INVENTORY;
    const contextInventory =
      inventory[appid]?.rgContexts[contextid]?.inventory?.rgInventory;
    if (!contextInventory) return;
    if (!isYou) forceVisibility();
    customizeItems(contextInventory);
    tradeOfferWindow.summarize(isYou);
  }

  inventoryManager.registerForUser(STEAMID, () => {
    /* hook for your inventory load */
  });

  if (urlParams.listing_intent !== undefined) {
    const isSelling = urlParams.listing_intent == "0";
    page.btns.$listing?.classList.add(isSelling ? "selling" : "buying");
    if (isSelling) forceInventory("440", "2");
  }

  if (urlParams.for_item !== undefined) {
    const [appid, contextid, assetid] = urlParams.for_item.split("_");
    TRADE_STATUS.them.assets.push({ appid, contextid, assetid, amount: 1 });
    W.RefreshTradeStatus(TRADE_STATUS, true);
    inventoryManager.register(PARTNER_STEAMID, appid, contextid, () => {
      if (!page.$deadItem) return;
      TRADE_STATUS.them.assets = [];
      W.RefreshTradeStatus(TRADE_STATUS, true);
      alert(
        `Seems like the item you are looking to buy (ID: ${assetid}) is no longer available. You should check other user's backpack and see if it's still there.`,
      );
    });
  }

  [STEAMID, PARTNER_STEAMID].forEach((steamid) => {
    inventoryManager.register(steamid, "440", "2", customizeElements);
  });

  function observeSlots(slotsEl: HTMLElement, isYou: boolean) {
    let lastSummarized = new Date();
    let timer: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(() => {
      const canInstant =
        !lastSummarized ||
        Date.now() - lastSummarized.getTime() > 200 ||
        slotsEl.children.length <= 204;
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          tradeOfferWindow.summarize(isYou);
          lastSummarized = new Date();
        },
        canInstant ? 10 : 200,
      );
    });
    observer.observe(slotsEl, {
      childList: true,
      characterData: false,
      subtree: true,
    });
  }

  observeSlots(page.$yourSlots, true);
  observeSlots(page.$theirSlots, false);

  const inventoryObserver = new MutationObserver((mutations) => {
    if (!mutations[0].addedNodes) return;
    const inv = mutations[0].addedNodes[0] as HTMLElement;
    const [steamid, appid, contextid] = (inv.id || "")
      .replace("inventory_", "")
      .split("_");
    if (steamid && appid && contextid)
      inventoryManager.call(steamid, appid, contextid);
  });
  inventoryObserver.observe(page.$inventories, {
    childList: true,
    characterData: false,
    subtree: false,
  });

  // Steam function overrides (performance patches)
  const hideEl = (el: HTMLElement | null) => {
    if (el) el.style.display = "none";
  };
  const showEl = (el: HTMLElement | null) => {
    if (el) el.style.display = "";
  };

  W.UpdateSlots = function (
    rgSlotItems: any,
    rgCurrency: any[],
    bYourSlots: boolean,
    user: any,
    version: number,
  ) {
    const slotContainerEl = document.getElementById(
      bYourSlots ? "your_slots" : "their_slots",
    )!;
    const elCurrencySlotContainer = bYourSlots
      ? W.$("your_slots_currency")
      : W.$("their_slots_currency");

    let cMaxSlotId = 0;
    if (Array.isArray(rgSlotItems)) {
      cMaxSlotId = rgSlotItems.length;
    } else {
      for (const s in rgSlotItems) {
        const n = parseInt(s);
        if (n && !isNaN(n)) cMaxSlotId = Math.max(n, cMaxSlotId);
      }
      cMaxSlotId++;
    }

    let cCurrenciesInTrade = 0;
    for (const cu of rgCurrency) {
      const inv = user.getInventory(cu.appid, cu.contextid);
      if (!inv || inv.BIsPendingInventory()) continue;
      cCurrenciesInTrade++;
      const currency = user.FindCurrency(cu.appid, cu.contextid, cu.currencyid);
      const stack = W.GetTradeItemStack(user, currency);
      if (parseInt(stack.amount) + parseInt(stack.fee) !== cu.amount) {
        W.UpdateTradeItemStackDisplay(currency, stack, cu.amount);
        if (!bYourSlots && !W.g_bTradeOffer)
          W.HighlightNewlyAddedItem(stack.element);
      }
      stack.version = version;
    }

    const rgCurrencySlots = elCurrencySlotContainer.children;
    if (cCurrenciesInTrade < rgCurrencySlots.length) {
      for (let i = 0; i < rgCurrencySlots.length; i++) {
        const elSlot = rgCurrencySlots[i];
        const stack = elSlot.stack;
        if (stack.version < version) {
          elSlot.remove();
          const orig = user.FindCurrency(
            stack.appid,
            stack.contextid,
            stack.id,
          );
          orig.amount = orig.original_amount;
          orig.trade_stack = null;
          if (bYourSlots) W.UpdateCurrencyDisplay(orig);
        }
      }
    }

    W.EnsureSufficientTradeSlots(bYourSlots, cMaxSlotId, cCurrenciesInTrade);

    let nNumBadItems = 0,
      firstBadItem: any = null,
      nNumExpiringItems = 0,
      firstExpiringItem: any = null;
    let nFullInventoryAppId: string | false = false;

    for (let slot = 0; slot < slotContainerEl.children.length; slot++) {
      const elSlot = slotContainerEl.children[slot] as HTMLElement;
      const elCurItem = elSlot.querySelector<HTMLElement>(".item");
      let elNewItem: HTMLElement | null = null;
      let bRemoveCurItem = elCurItem != null;
      let bItemIsNewToTrade = false,
        bStackAmountChanged = false;

      if (rgSlotItems[slot]) {
        const { appid, contextid, assetid, amount } = rgSlotItems[slot];
        if (
          !bYourSlots &&
          !W.UserYou.BAllowedToRecieveItems(appid, contextid)
        ) {
          if (
            !nFullInventoryAppId &&
            W.UserYou.BInventoryIsFull(appid, contextid)
          )
            nFullInventoryAppId = appid;
          if (!nNumBadItems) firstBadItem = rgSlotItems[slot];
          nNumBadItems++;
        }
        const elItem = user.findAssetElement(appid, contextid, assetid);
        const escrowEnd = W.g_dateEscrowEnd;
        if (
          escrowEnd != null &&
          elItem.rgItem &&
          typeof elItem.rgItem.item_expiration === "string"
        ) {
          if (escrowEnd >= new Date(elItem.rgItem.item_expiration)) {
            if (!nNumExpiringItems) firstExpiringItem = rgSlotItems[slot];
            nNumExpiringItems++;
          }
        }
        if (
          elCurItem?.rgItem?.appid == appid &&
          elCurItem.rgItem.contextid == contextid &&
          elCurItem.rgItem.id == assetid &&
          !elCurItem.rgItem.unknown
        ) {
          bRemoveCurItem = false;
          if (elCurItem.rgItem.is_stackable) {
            bStackAmountChanged = amount != elCurItem.rgItem.amount;
            W.UpdateTradeItemStackDisplay(
              elCurItem.rgItem.parent_item,
              elCurItem.rgItem,
              amount,
            );
          }
        } else {
          elNewItem = elItem;
          const item = elNewItem.rgItem;
          if (!item.unknown) bItemIsNewToTrade = true;
          if (item.is_stackable) {
            const stack = W.GetTradeItemStack(user, item);
            bStackAmountChanged = amount != stack.amount;
            W.UpdateTradeItemStackDisplay(item, stack, amount);
            elNewItem = stack.element;
          }
          if (elNewItem?.parentNode) {
            hideEl(
              elNewItem.parentNode.querySelector<HTMLElement>(
                ".slot_actionmenu_button",
              ),
            );
            if (W.BIsInTradeSlot(elNewItem)) {
              W.CleanupSlot(
                (elNewItem.parentNode as HTMLElement).parentNode as HTMLElement,
              );
              bItemIsNewToTrade = false;
            }
            elNewItem.remove();
          }
        }
      }

      if (elCurItem && bRemoveCurItem) {
        if (elCurItem.rgItem?.is_stackable) {
          W.UpdateTradeItemStackDisplay(
            elCurItem.rgItem.parent_item,
            elCurItem.rgItem,
            0,
          );
          elCurItem.remove();
        } else if (elCurItem.rgItem?.homeElement) {
          elCurItem.rgItem.homeElement.appendChild(elCurItem.remove());
        } else {
          elCurItem.remove();
        }
        W.CleanupSlot(elSlot);
      }

      if (elNewItem) {
        W.PutItemInSlot(elNewItem, elSlot);
        if (bItemIsNewToTrade && !bYourSlots && !W.g_bTradeOffer)
          W.HighlightNewlyAddedItem(elNewItem);
      } else if (bStackAmountChanged && !bYourSlots && !W.g_bTradeOffer) {
        W.HighlightNewlyAddedItem(elCurItem);
      }
    }

    const getName = (i: any) =>
      i.name.escapeHTML ? i.name.escapeHTML() : i.name;

    if (
      !bYourSlots &&
      nNumBadItems !== W.g_nItemsFromContextWithNoPermissionToReceive &&
      !W.UserThem.BIsLoadingInventoryData()
    ) {
      W.g_nItemsFromContextWithNoPermissionToReceive = nNumBadItems;
      if (nNumBadItems > 0 && firstBadItem) {
        const item = user.findAsset(
          firstBadItem.appid,
          firstBadItem.contextid,
          firstBadItem.assetid,
        );
        let strEvent = item
          ? nNumBadItems === 1
            ? `You are not allowed to receive the item "${getName(item)}."`
            : `You are not allowed to receive ${nNumBadItems} of the items being offered including "${getName(item)}."`
          : nNumBadItems === 1
            ? "You are not allowed to receive one of the items being offered."
            : `You are not allowed to receive ${nNumBadItems} of the items being offered.`;
        const elEvent = new W.Element("div", { class: "logevent" });
        elEvent.update(strEvent);
        W.$("log").appendChild(elEvent);
      }
    }

    if (
      nNumExpiringItems !== W.g_rgnItemsExpiringBeforeEscrow[bYourSlots ? 0 : 1]
    ) {
      W.g_rgnItemsExpiringBeforeEscrow[bYourSlots ? 0 : 1] = nNumExpiringItems;
      if (nNumExpiringItems > 0 && firstExpiringItem) {
        const item = user.findAsset(
          firstExpiringItem.appid,
          firstExpiringItem.contextid,
          firstExpiringItem.assetid,
        );
        let strEvent = item
          ? nNumExpiringItems === 1
            ? `The item "${getName(item)}" cannot be included in this trade because it will expire before the trade hold period is over.`
            : `Some items, including "${getName(item)}," cannot be included in this trade because they will expire before the trade hold period is over.`
          : nNumExpiringItems === 1
            ? "One item cannot be included in this trade because it will expire before the trade hold period is over."
            : "Some items cannot be included in this trade because they will expire before the trade hold period is over.";
        const elEvent = new W.Element("div", { class: "logevent" });
        elEvent.update(strEvent);
        W.$("log").appendChild(elEvent);
      }
    }
  };

  W.PutItemInSlot = function (elItem: HTMLElement, elSlot: HTMLElement) {
    const item = (elItem as any).rgItem;
    if (
      elItem.parentNode &&
      (elItem.parentNode as Node).nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) {
      hideEl(
        elItem.parentNode.querySelector<HTMLElement>(".slot_actionmenu_button"),
      );
      elItem.remove();
    }
    elSlot.querySelector(".slot_inner")!.appendChild(elItem);
    if (item?.appid && W.g_rgAppContextData[item.appid]) {
      const rgAppData = W.g_rgAppContextData[item.appid];
      const slotAppLogo = elSlot.querySelector<HTMLElement>(".slot_applogo");
      if (slotAppLogo) {
        slotAppLogo.querySelector("img")!.src = rgAppData.icon;
        showEl(slotAppLogo);
      }
      if (
        typeof W.g_rgPlayedApps !== "undefined" &&
        W.g_rgPlayedApps !== false &&
        !W.g_rgPlayedApps[item.appid]
      ) {
        const w = "You've never played the game this item is from.";
        if (!item.fraudwarnings) item.fraudwarnings = [w];
        else if (!item.fraudwarnings.includes(w)) item.fraudwarnings.push(w);
      }
      if (item.id && item.fraudwarnings)
        showEl(elSlot.querySelector<HTMLElement>(".slot_app_fraudwarning"));
      else hideEl(elSlot.querySelector<HTMLElement>(".slot_app_fraudwarning"));
    } else {
      hideEl(elSlot.querySelector<HTMLElement>(".slot_applogo"));
      hideEl(elSlot.querySelector<HTMLElement>(".slot_app_fraudwarning"));
    }
    const btn = elSlot.querySelector<HTMLElement>(".slot_actionmenu_button");
    showEl(btn);
    btn?.addEventListener("click", () =>
      W.HandleTradeActionMenu(
        btn,
        item,
        item.is_their_item ? W.UserThem : W.UserYou,
      ),
    );
    elSlot.classList.add("has_item");
    (elSlot as any).hasItem = true;
  };

  W.EnsureSufficientTradeSlots = function (
    bYourSlots: boolean,
    cSlotsInUse: number,
    cCurrencySlotsInUse: number,
  ) {
    const cTotal = cSlotsInUse + cCurrencySlotsInUse;
    const cDesired = W.Economy_UseResponsiveLayout?.()
      ? cTotal + 1
      : Math.max(Math.floor((cTotal + 5) / 4) * 4, 8);
    const el = bYourSlots ? page.$yourSlots : page.$theirSlots;
    const cDesiredItem = cDesired - cCurrencySlotsInUse;
    const cCurrentItem = el.childElementCount;
    const cCurrent = cCurrentItem + cCurrencySlotsInUse;

    if (cDesired > cCurrent) {
      const frag = document.createDocumentFragment();
      for (let i = cCurrentItem; i < cDesiredItem; i++) {
        const id = `${bYourSlots ? "your" : "their"}_slot_${i}`;
        const s = W.CreateSlotElement(id);
        s.iSlot = i;
        frag.appendChild(s);
      }
      el.appendChild(frag);
    } else if (cDesired < cCurrent) {
      const prefix = bYourSlots ? "your_slot_" : "their_slot_";
      const toRemove: HTMLElement[] = [];
      for (let i = cDesiredItem; i < cCurrentItem; i++) {
        const e = el.querySelector<HTMLElement>(`#${prefix}${i}`);
        if (e) {
          e.id = "";
          el.parentElement!.appendChild(e);
          toRemove.push(e);
        }
      }
      toRemove.forEach((e) => e.remove());
    }
  };

  W.GTradeStateManager.RemoveItemsFromTrade = function (items: HTMLElement[]) {
    function checkItems(items: HTMLElement[], isYou: boolean): boolean {
      if (!items.length) return false;
      const rgItems: any[] = [];
      for (let i = items.length - 1; i >= 0; i--) {
        const elItem = items[i];
        const item = (elItem as any).rgItem;
        if (W.BIsInTradeSlot(elItem))
          W.CleanupSlot(
            (elItem.parentNode as HTMLElement).parentNode as HTMLElement,
          );
        if (item.is_stackable) {
          W.SetStackableItemInTrade(item, 0);
          continue;
        }
        W.RevertItem(item);
        item.homeElement.down(".slot_actionmenu_button").show();
        rgItems.push(item);
      }
      if (!rgItems.length) return false;
      const grouped = groupBy(rgItems, "appid");
      for (const a in grouped) {
        (grouped as any)[a] = groupBy((grouped as any)[a], "contextid");
        for (const c in (grouped as any)[a])
          (grouped as any)[a][c] = groupBy((grouped as any)[a][c], "id");
      }
      const slots = isYou ? TRADE_STATUS.me : TRADE_STATUS.them;
      let bChanged = false;
      for (let i = slots.assets.length - 1; i >= 0; i--) {
        const { appid, contextid, assetid } = slots.assets[i];
        if ((grouped as any)[appid]?.[contextid]?.[assetid]) {
          bChanged = true;
          slots.assets.splice(i, 1);
        }
      }
      return bChanged;
    }
    const [yours, theirs] = partition(
      items,
      (el) => !(el as any).rgItem.is_their_item,
    );
    const changed = checkItems(yours, true) || checkItems(theirs, false);
    if (changed) {
      W.GTradeStateManager.m_bChangesMade = true;
      W.GTradeStateManager.UpdateTradeStatus();
    }
  };

  // Initial state
  tradeOfferWindow.userChanged(page.$activeInventoryTab);
  if (getStored(stored.id_visible) === "1" && page.fields.$ids)
    page.fields.$ids.style.display = "";
  if (urlParams.listing_intent !== undefined) {
    page.btns.$listing?.classList.add(
      urlParams.listing_intent == "0" ? "selling" : "buying",
    );
  }
}
