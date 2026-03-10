<p align="center">
  <img src="https://raw.githubusercontent.com/offish/tf2-trader/refs/heads/main/public/logo.svg" width="128">
</p>

<h1 align="center">TF2 Trader</h1>

<p align="center">
  Extension for Team Fortress 2 Trading.<br>
  Built using WXT and Vue 3.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/tf2-trader/gmicpekfpbikhibodgokfpghadkclhoe">
    <img src=".github/images/chrome.png" height="60">
  </a>
  <!-- <a href="https://addons.mozilla.org/firefox/addon/">
    <img src=".github/images/firefox.png" height="60">
  </a> -->
</p>

## Features

- One-click trade offer creation with items and pure from Backpack.TF
- Instant accept and decline buttons for incoming trade offers
- Item summary counts on trade offers
- Item summary counts on the trade offer history page
- Shift-click item range selection on STNTrading.eu
- Keyboard-based backpack sorting on Backpack.TF profile inventories
- Unusual effect previews on Steam Community Market listings
- Unusual effect previews on inventory items
- Direct links to real-money marketplaces from Steam Community Market listings
- One-click "Check price on PriceDB.io" button for inventory items
- Link to PriceDB.io when right clicking items on Scrap.TF
- Integrated PriceDB.io price graph on Backpack.TF stats pages (including next.backpack.tf)
- Listing parameters included in trade URLs on Backpack.TF and next.backpack.tf
- Item name parameter support in Backpack.TF trade URLs
- Graphs and additional stats displayed below listings on Backpack.TF stats pages (including next.backpack.tf)
- Quick access buttons for rep.tf and Backpack.TF on trade offers
- Additional item borders and icons in inventory views
- Quick link to legacy Backpack.TF pages from Marketplace.TF item listings

## Development

```bash
git clone git@github.com:offish/tf2-trader.git
cd tf2-trader
npm i
```

In the root directory you can add `web-ext.config.ts`.
Here you can add the path to your preffered browser.
This browser will not have persistant memory unless you use Chromium and configure it to do so.

```ts
import { defineWebExtConfig } from "wxt";

export default defineWebExtConfig({
  binaries: {
    chrome:
      "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
  },
});
```

Then run:

```bash
npm run dev
```

This will automatically open your browser, install the extension and have hot reloads on changes.
You might want to login to Steam through this browser, OR you can "Load unpacked" in a browser you are already logged into.
This will also have hot reloads. To select the extension navigate to the folder of the extension and select the folder under the `.output` folder.

## Showcase

### Inventory

![Inventory](/.github/images/inventory.png)

### Steam Market Listings

![Trade History](/.github/images/market-listings.png)

### Trade Offer

![Trade Offer](/.github/images/trade-offer.png)

### Trade History

![Trade History](/.github/images/trade-history.png)

### BackpackTF Stats

![Trade History](/.github/images/backpack-stats.png)

## Acknowledgements

This repository builds upon a list of other extensions/scripts

- [steam-trade-offer-enhancer](https://github.com/juliarose/steam-trade-offer-enhancer) by [juliarose](https://github.com/juliarose)
- [csgo-trader-extension](https://github.com/gergelyszabo94/csgo-trader-extension) by [Gergely Szabo](https://github.com/gergelyszabo94)
- [SteamTradeHistoryLight](https://github.com/DaSimple619/SteamTradeHistoryLight) by [dasimple](https://github.com/DaSimple619)
- [bptf-pricedb-graph-integration](https://github.com/purplebarber/bptf-pricedb-graph-integration) by [purplebarber](https://github.com/purplebarber)
