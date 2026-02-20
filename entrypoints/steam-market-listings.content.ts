import "@/styles/steam-market-listings.css";

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
      return assets?.[ids.appid]?.[ids.contextid]?.[ids.assetid];
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

    const resultsRows = document.getElementById("searchResultsRows");
    if (resultsRows) {
      const observer = new MutationObserver(addAttributesToResults);
      observer.observe(resultsRows, { childList: true });

      addAttributesToResults();
    }

    const isCommodityItem =
      document.querySelector(".market_commodity_order_block") !== null;
    const appID = "440";
    const fullName = "Unusual Team Captain";
    const selector = isCommodityItem
      ? ".market_commodity_order_block"
      : "#largeiteminfo_warning";

    const elementToInsertTo = document.querySelector(selector);

    if (elementToInsertTo) {
      const sites = [
        {
          id: "skinport",
          name: "Skinport.com",
          url: `https://skinport.com/market/${appID}?search=${fullName}&r=gery`,
        },
        {
          id: "csfloat",
          name: "CSFloat Market",
          url: `https://csfloat.com/search?market_hash_name=${fullName}&ref=gerytrading`,
        },
      ];

      const adsHtml = sites
        .map(
          (site) => `
            <div class="site_ad">
              <a href="${site.url}" target="_blank" class="site_ad_link">
                <img alt="${site.name}" style="height: 50px" src="">
                <br>${site.name}
              </a>
            </div>
          `,
        )
        .join("");

      elementToInsertTo.insertAdjacentHTML(
        "beforebegin",
        `<div>
          <span class="sites_ad_title">You can save 20-35% by buying this item on one of these trusted marketplaces for real money:</span>
          <div class="site_ads">
            ${adsHtml}
          </div>`,
      );
    }
  },
});
