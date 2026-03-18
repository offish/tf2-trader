import { UNUSUAL_EFFECTS, TAG_TO_QUALITY } from "./data";

const STORAGE_KEY_PREFIX = "tf2_trader";

export function getStored(name: string): string | null {
  return localStorage.getItem(STORAGE_KEY_PREFIX + name);
}

export function setStored(name: string, value: string | number): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + name, String(value));
}

export const getEffectID = (value: string): number => {
  return UNUSUAL_EFFECTS[value];
};

export const getEffectURL = (value: number | string): string => {
  const effect = typeof value === "string" ? parseInt(value, 10) : value;
  return `https://itempedia.tf/assets/particles/${effect}_94x94.png`;
};

const getQualityFromTags = (item: any): number => {
  if (item.tags) {
    const qualityTag = item.tags.find((tag: any) => tag.category === "Quality");
    if (qualityTag) {
      return (
        TAG_TO_QUALITY[qualityTag.localized_tag_name] ??
        TAG_TO_QUALITY[qualityTag.internal_name] ??
        6
      );
    }
  }

  // fallback
  const COLOR_TO_QUALITY: Record<string, number> = {
    "4D7455": 1,
    "476291": 3,
    "8650AC": 5,
    "7D6D00": 6,
    CF6A32: 11,
    "38F3AB": 13,
    FAFAFA: 15,
  };

  const color = (item.name_color || "").toUpperCase();
  return COLOR_TO_QUALITY[color] ?? 6;
};

export const getItemAttributes = (item: any) => {
  const color = (item.name_color || "").toUpperCase();
  const attributes: any = {
    color,
    quality: getQualityFromTags(item),
  };

  const isUnique = attributes.quality === 6;
  const isStrangeQuality = attributes.quality === 11;
  const matchesLowcraft = item.name?.match(/.* #(\d+)$/);
  const hasStrangeItemType =
    /^Strange /.test(item.market_hash_name) &&
    item.type &&
    /^Strange ([0-9\w\s\\(\)'\-]+) \- ([0-9\w\s\(\)'-]+): (\d+)\n?$/.test(
      item.type,
    );

  if (matchesLowcraft) attributes.lowcraft = parseInt(matchesLowcraft[1]);
  if (!isStrangeQuality && hasStrangeItemType) attributes.strange = true;
  if (!item.descriptions) return attributes;

  item.descriptions.forEach((desc: any) => {
    const effectMatch =
      !isUnique &&
      desc.color === "ffd700" &&
      desc.value.match(/^\u2605 Unusual Effect: (.+)$/);

    if (effectMatch) {
      const effectName = effectMatch[1];
      const effectID = getEffectID(effectName);
      if (effectID) attributes.effect = effectID;
    }

    if (
      desc.color === "7ea9d1" &&
      desc.value.includes("(spell only active during event)")
    )
      attributes.spelled = true;

    if (desc.color === "756b5e" && desc.value.match(/^\(?(.+?):\s*\d+\)?$/))
      attributes.parts = true;

    if (desc.color === "7ea9d1" && desc.value === "Killstreaks Active") {
      // Detect tier from market_hash_name / name so the SKU is kt-1/kt-2/kt-3.
      const itemName: string = item.market_hash_name || item.name || "";
      if (/Professional Killstreak/i.test(itemName)) attributes.killstreak = 3;
      else if (/Specialized Killstreak/i.test(itemName))
        attributes.killstreak = 2;
      else attributes.killstreak = 1;
    }
  });

  // Series number for crates/cases — stored as a "Series" tag.
  // localized_tag_name is typically "#148"; internal_name is "series_148".
  if (item.tags) {
    const seriesTag = item.tags.find((tag: any) => tag.category === "Series");
    if (seriesTag) {
      const fromLabel = ((seriesTag.localized_tag_name as string) ?? "").match(
        /#(\d+)/,
      );
      const fromInternal = ((seriesTag.internal_name as string) ?? "").match(
        /(\d+)$/,
      );
      const num = fromLabel
        ? parseInt(fromLabel[1])
        : fromInternal
          ? parseInt(fromInternal[1])
          : null;
      if (num) attributes.series = num;
    }
  }

  // Also try parsing the series from market_hash_name (e.g. "Cosmetic Case #148").
  // This covers cases where the tag is absent but the market name has it.
  if (!attributes.series) {
    const mhn: string = item.market_hash_name ?? "";
    const mhnMatch = mhn.match(/#(\d+)$/);
    if (mhnMatch) attributes.series = parseInt(mhnMatch[1]);
  }

  return attributes;
};

export const addAttributesToElement = (itemEl: HTMLElement, item: any) => {
  if (itemEl.hasAttribute("data-checked")) return;

  const attrs = getItemAttributes(item);
  const iconsEl = document.createElement("div");
  const classes: string[] = [];

  if (attrs.effect) {
    itemEl.style.backgroundImage = `url('${getEffectURL(attrs.effect)}')`;
    classes.push("unusual");
  }
  if (attrs.strange) classes.push("strange");
  if (attrs.uncraft) classes.push("uncraft");

  if (attrs.lowcraft) {
    const div = document.createElement("div");
    div.textContent = `#${attrs.lowcraft}`;
    div.className = "lowcraft";
    div.style.color = `#${attrs.color}`;
    itemEl.appendChild(div);
  }

  const addIcon = (src: string, cls: string, w: number, h: number) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = cls;
    img.width = w;
    img.height = h;
    img.style.objectFit = "contain";
    img.style.display = "inline-block";
    img.style.verticalAlign = "top";
    iconsEl.appendChild(img);
  };

  if (attrs.spelled) addIcon("https://scrap.tf/img/spell.png", "spell", 14, 20);
  if (attrs.parts)
    addIcon("https://itempedia.tf/assets/wrench.png", "parts", 14, 20);
  if (attrs.killstreak)
    addIcon("https://itempedia.tf/assets/icon-ks.png", "ks", 14, 15);
  if (iconsEl.children.length > 0) {
    iconsEl.className = "icons";
    itemEl.appendChild(iconsEl);
  }

  // itemEl.style.position = "relative";

  if (classes.length > 0) itemEl.classList.add(...classes);
  itemEl.setAttribute("data-checked", "1");
};

/**
 * Builds a PriceDB/tf2-schema SKU string from a defindex and parsed item attributes.
 * e.g. "5021;6", "725;5;u703", "5021;6;uncraftable"
 */
export const buildSku = (defindex: string | number, item: any): string => {
  const parts: (string | number)[] = [defindex, item.quality ?? 6];
  if (item.uncraft) parts.push("uncraftable");
  if (item.killstreak) parts.push(`kt-${item.killstreak}`);
  if (item.effect) parts.push(`u${item.effect}`);
  if (item.series) parts.push(`c${item.series}`);
  return parts.join(";");
};

/**
 * Extracts the defindex from a Steam item description by parsing the wiki
 * itemredirect URL embedded in the item's actions array.
 * Returns null if no wiki link is found.
 */
export const getDefindexFromDesc = (desc: any): string | null => {
  if (!desc?.actions) return null;
  for (const action of desc.actions) {
    const match = (action.link as string | undefined)?.match(
      /itemredirect\.php\?id=(\d+)/,
    );
    if (match) return match[1];
  }
  return null;
};
