# TF2 Trader

Extension for Team Fortress 2 Trading.

Built using WXT and Vue 3.

## Features

- Instant Accept/Decline buttons on Trade Offers
- See Unusual Effects in inventory and on Steam Community Market
- Item count summaries for Trade Offers
- Item count summaries for Trade History
- STN item range select (shift+click)
- Old BackpackTF link on item pages

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
