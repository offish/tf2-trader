export interface SteamItem {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  market_hash_name?: string;
  type?: string;
  name_color?: string;
  background_color?: string;
  icon_url?: string;
  icon_url_large?: string;
  fraudwarnings?: string[];
  actions?: Array<{ link: string; name: string }>;
  descriptions?: Array<{ value: string; color?: string }>;
  tags?: Array<{ category: string; internal_name?: string; localized_tag_name?: string; category_name?: string; color?: string }>;
  appdata?: { def_index?: string };
  [key: string]: unknown;
}

export interface ItemDescription {
  type: string;
  value: string;
  color?: string;
  label?: string;
  app_data?: {
    limited?: string;
    def_index?: string;
    quality?: string;
    is_itemset_name?: string;
    "0"?: string;
  };
}

export interface ItemTag {
  category: string;
  internal_name: string;
  localized_category_name: string;
  localized_tag_name: string;
  color?: string;
}

export interface TradeOfferSummary {
  keys: number;
  metal: number;
  items: Map<string, number>;

export interface Currencies {
  keys?: number;
  metal?: number;
}

export interface BackpackTfListing {
  intent: "buy" | "sell";
  item?: {
    name: string;
    quality?: number;
  };
  currencies?: {
    keys?: number;
    metal?: number;
  };
}

export interface ItemAttributes {
  color: string;
  lowcraft?: number;
  strange?: boolean;
  effect?: number;
  spelled?: boolean;
  parts?: boolean;
  killstreak?: number;
  uncraft?: boolean;
}

export interface ResolvedItemAttributes {
  color: string;
  quality: number;
  lowcraft?: number;
  strange?: boolean;
  effect?: number;
  spelled?: boolean;
  parts?: boolean;
  killstreak?: number;
  uncraft?: boolean;
  series?: number;
}

export interface ButtonConfig {
  title: string;
  url: string;
  className: string;
}

export interface ItemProps {
  classinfo: string;
  app: string;
  color: string;
}

export interface AggregatedItem {
  el: HTMLElement;
  count: number;
  props: ItemProps;
}

export interface ParsedItem {
  id: string;
  name: string;
}

// Steam rgInventory entry — merged asset + description, same shape Steam's
// loadInventory produces so it can be injected when an item is missing.
export interface SteamRgEntry {
  id: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  appid: number;
  contextid: string;
  [key: string]: any;
}
