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
  descriptions?: Array<{ value: string; color?: string }>;
  tags?: Array<{ category: string; name: string }>;
  appdata?: { def_index?: string };
  [key: string]: unknown;
}

export interface Currencies {
  keys?: number;
  metal?: number;
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
