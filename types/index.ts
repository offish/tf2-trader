export interface SteamItem {
  appid: number;
  contextid: string;
  assetid: string;
  classid: string;
  instanceid: string;
  amount: string;
  descriptions?: ItemDescription[];
  tags?: ItemTag[];
  market_hash_name?: string;
  name?: string;
  type?: string;
  tradable?: number;
  marketable?: number;
  commodity?: number;
  name_color?: string;
  background_color?: string;
  icon_url?: string;
  icon_url_large?: string;
  fraudwarnings?: string[];
  actions?: Array<{ link: string; name: string }>;
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
}

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

export const TF2_APPID = 440;
export const TF2_CONTEXTID = "2";
