import { TAG_TO_QUALITY } from "./data";

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

    if (desc.color === "7ea9d1" && desc.value === "Killstreaks Active")
      attributes.killstreak = true;

    if (!desc.color && /^\( Not.* Usable in Crafting/.test(desc.value))
      attributes.uncraft = true;

    if (
      !isStrangeQuality &&
      desc.color?.toUpperCase() === "CF6A32" &&
      desc.value.trim() === "Strange Stat Clock Attached"
    )
      attributes.strange = true;
  });

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
