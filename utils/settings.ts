import type { Settings, SiteKey, AutobotSiteKey } from "@/types";

const STORAGE_KEY = "tf2trader_settings";

export const DEFAULT_SETTINGS: Settings = {
  sites: {
    backpackStats: true,
    backpackClassifieds: true,
    nextBackpackStats: true,
    nextBackpackClassifieds: true,
    steamInventory: true,
    steamMarket: true,
    steamTradeOfferNew: true,
    steamTradeOffer: true,
    steamTradeOffers: true,
    steamTradeHistory: true,
    steamProfile: true,
    backpackProfile: true,
    marketplace: true,
    scrapTf: true,
    stnTrading: true,
  },
  autobot: {
    enabled: false,
    sites: {
      backpackStats: true,
      nextBackpackStats: true,
      pricedb: true,
      steamMarket: true,
      steamInventory: true,
    },
  },
};

/** Deep-merge `defaults` into `stored` so newly added keys are always present. */
function mergeWithDefaults(stored: unknown): Settings {
  const s = (stored ?? {}) as Record<string, unknown>;
  const storedSites = (s.sites ?? {}) as Partial<Record<SiteKey, boolean>>;
  const storedAutobot = (s.autobot ?? {}) as {
    enabled?: boolean;
    sites?: Partial<Record<AutobotSiteKey, boolean>>;
  };

  const sites = {} as Record<SiteKey, boolean>;
  for (const key of Object.keys(DEFAULT_SETTINGS.sites) as SiteKey[]) {
    sites[key] = storedSites[key] ?? DEFAULT_SETTINGS.sites[key];
  }

  const autobotSites = {} as Record<AutobotSiteKey, boolean>;
  for (const key of Object.keys(
    DEFAULT_SETTINGS.autobot.sites,
  ) as AutobotSiteKey[]) {
    autobotSites[key] =
      storedAutobot.sites?.[key] ?? DEFAULT_SETTINGS.autobot.sites[key];
  }

  return {
    sites,
    autobot: {
      enabled: storedAutobot.enabled ?? DEFAULT_SETTINGS.autobot.enabled,
      sites: autobotSites,
    },
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return mergeWithDefaults(stored[STORAGE_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}

export function onSettingsChanged(
  cb: (settings: Settings) => void,
): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  ) => {
    if (STORAGE_KEY in changes) {
      cb(mergeWithDefaults(changes[STORAGE_KEY].newValue));
    }
  };
  browser.storage.local.onChanged.addListener(listener);
  return () => browser.storage.local.onChanged.removeListener(listener);
}
