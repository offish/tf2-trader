import "@/styles/steam-market-listings.css";
import { addAttributesToElement } from "@/utils/inventory";

export default defineContentScript({
  matches: ["*://steamcommunity.com/market/listings/440/*"],
  world: "MAIN",

  main() {
    const getItemIdsFromRow = (rowEl: HTMLElement) => {
      const buyButtonLinkEl = rowEl.querySelector(
        "div.market_listing_buy_button a",
      );
      if (!buyButtonLinkEl) return null;

      const href = buyButtonLinkEl.getAttribute("href") || "";
      const params = href
        .replace("javascript:BuyMarketListing", "")
        .replace(/[\,\(/) ]/g, "");
      const split = params.split(/'(.+?)'/g).filter(Boolean);

      return {
        appid: split[2],
        contextid: split[3],
        assetid: split[4],
      };
    };

    const getAssetData = (ids: {
      appid: string;
      contextid: string;
      assetid: string;
    }) => {
      const win = window as any;
      const assets = win.g_rgAssets;
      const asset = assets?.[ids.appid]?.[ids.contextid]?.[ids.assetid];
      return asset;
    };
    const addAttributesToResults = () => {
      const resultsRows = document.getElementById("searchResultsRows");

      if (!resultsRows) return;

      const rowsList = resultsRows.getElementsByClassName("market_listing_row");

      Array.from(rowsList).forEach((row) => {
        const rowEl = row as HTMLElement;
        if (rowEl.hasAttribute("data-checked")) return;

        const ids = getItemIdsFromRow(rowEl);
        const asset = ids ? getAssetData(ids) : null;

        if (!asset) return;

        const itemImgContainerEl = rowEl.querySelector(
          "div.market_listing_item_img_container",
        );
        const itemImgEl = itemImgContainerEl?.querySelector(
          "img.market_listing_item_img",
        ) as HTMLImageElement;

        if (itemImgContainerEl && itemImgEl) {
          const itemWrapper = document.createElement("div");
          const imgSrc = itemImgEl.getAttribute("src");

          itemWrapper.classList.add(
            "market_listing_item_img",
            "economy_item_hoverable",
          );
          itemWrapper.setAttribute(
            "style",
            itemImgEl.getAttribute("style") || "",
          );
          itemWrapper.style.position = "relative";
          itemWrapper.style.backgroundImage = `url('${imgSrc}')`;

          itemImgEl.classList.remove("market_listing_item_img");
          itemImgEl.style.backgroundColor = "transparent";

          itemImgEl.parentNode?.replaceChild(itemWrapper, itemImgEl);
          itemWrapper.appendChild(itemImgEl);
          addAttributesToElement(itemWrapper, asset);
          rowEl.setAttribute("data-checked", "1");
        }
      });
    };

    function getItemNameFromUrl(): string | null {
      try {
        const url = new URL(window.location.href);
        const pathParts = url.pathname.split("/");
        const lastPart = pathParts[pathParts.length - 1];

        if (lastPart) {
          const itemName = decodeURIComponent(lastPart);
          console.log("Extracted Item Name:", itemName);
          return itemName;
        }
      } catch (e) {
        console.error("Failed to parse name from URL", e);
      }

      return null;
    }

    const resultsRows = document.getElementById("searchResultsRows");
    if (resultsRows) {
      const observer = new MutationObserver(addAttributesToResults);
      observer.observe(resultsRows, { childList: true });

      addAttributesToResults();
    }

    const isCommodityItem =
      document.querySelector(".market_commodity_order_block") !== null;
    const fullName = getItemNameFromUrl();
    const selector = isCommodityItem
      ? ".market_commodity_order_block"
      : "#largeiteminfo_warning";

    const elementToInsertTo = document.querySelector(selector);

    if (elementToInsertTo) {
      const sites = [
        {
          id: "skinport",
          name: "Skinport.com",
          url: `https://skinport.com/market/440?search=${fullName}&r=guidetf`,
          icon: "https://skinport.com/favicon.ico",
        },
        {
          id: "manncostore",
          name: "ManncoStore",
          url: "https://mannco.store/?ref=guidetf",
          icon: "https://mannco.store/statics/img/logo.svg",
        },
        {
          id: "tradeit",
          name: "Tradeit.gg",
          url: "https://tradeit.gg/tf2/trade?aff=guide",
          icon: "https://tradeit.gg/images/logo-full.svg",
        },
        {
          id: "marketplacetf",
          name: "MarketplaceTF",
          url: "https://marketplace.tf/",
          icon: "https://marketplace.tf/favicon.ico",
        },
        {
          id: "merchanttf",
          name: "MerchantTF",
          url: "https://merchant.tf/r/guide",
          icon: "https://merchant.tf/favicon.ico",
        },
        {
          id: "cstrade",
          name: "CS.TRADE",
          url: "https://cs.trade/ref/TF2GUIDES",
          icon: "https://cs.trade/favicon.ico",
        },
        {
          id: "skinscash",
          name: "SkinsCash",
          url: "https://skins.cash/user/ref/76561198253325712",
          icon: "https://skins.cash/favicon.ico",
        },
      ];
      const adsHtml = sites
        .map(
          (site) => `
        <div class="site_ad">
          <a href="${site.url}" target="_blank" class="site_ad_link">
            <div class="site_ad_icon_wrapper">
              <img alt="${site.name}" src="${site.icon}">
            </div>
            <span class="site_ad_name">${site.name}</span>
          </a>
        </div>
      `,
        )
        .join("");

      elementToInsertTo.insertAdjacentHTML(
        "beforebegin",
        `<div class="referral-container">
      <span class="sites_ad_title">You can save 20-35% by buying this item on these trusted marketplaces:</span>
      <div class="site_ads">
        ${adsHtml}
      </div>
    </div>`,
      );
    }
  },
});
