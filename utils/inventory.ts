export const getItemAttributes = (item: any) => {
  const attributes: any = { color: (item.name_color || "").toUpperCase() };
  const isUnique = attributes.color === "7D6D00";
  const isStrangeQuality = attributes.color === "CF6A32";
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
    const effectName = effectMatch[1];
    const effectId = getEffectId(effectName);

    if (effectMatch && effectId) attributes.effect = effectId;

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

  const addIcon = (src: string, cls: string) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = cls;
    iconsEl.appendChild(img);
  };

  if (attrs.spelled) addIcon("https://scrap.tf/img/spell.png", "spell");

  if (attrs.parts) addIcon("https://itempedia.tf/assets/wrench.png", "parts");

  if (attrs.killstreak)
    addIcon("https://itempedia.tf/assets/icon-ks.png", "ks");

  if (iconsEl.children.length > 0) {
    iconsEl.className = "icons";
    itemEl.appendChild(iconsEl);
  }

  if (classes.length > 0) itemEl.classList.add(...classes);
  itemEl.setAttribute("data-checked", "1");
};
