export const refinedToKeys = (refValue: number, keyValue: number): number => {
  return Math.round((refValue / keyValue) * 10) / 10;
};

export const parseItem = (itemEl: HTMLElement) => {
  const data = itemEl.dataset;
  const details: any = {
    raw: data.price ? parseFloat(data.price) : 0,
    refined: 0,
    currency: "",
    average: 0,
  };

  const pBptf = data.p_bptf || "";
  const match = pBptf.match(/^([\d\.]*)[\-\u2013]?([\d\.]*)? (\w*)/);

  if (match) {
    const currencyNames: Record<string, string> = {
      metal: "metal",
      ref: "metal",
      keys: "keys",
      key: "keys",
    };
    details.value = parseFloat(match[1]);
    details.currency = currencyNames[match[3]] || "";
    details.average = match[2]
      ? (details.value + parseFloat(match[2])) / 2
      : details.value;
  }

  const refStr = data.p_bptf_all || "";
  const matchRef = refStr.replace(/,/g, "").match(/(\d+\.?\d*) ref/);
  const refVal = matchRef ? parseFloat(matchRef[1]) : 0;

  details.refined =
    refVal.toFixed(2) === details.raw.toFixed(2)
      ? details.raw
      : refVal || details.raw;

  return details;
};

export const getKeysListedValue = (items: HTMLElement[], keyValue: number) => {
  let totalRef = 0;
  items.forEach((el) => {
    const listingPrice = el.dataset.listing_price || "";
    const keysMatch = listingPrice.match(/(\d+\.?\d*) keys?/);
    const refMatch = listingPrice.match(/(\d+\.?\d*) ref/);

    const keys = keysMatch ? parseFloat(keysMatch[1]) : 0;
    const ref = refMatch ? parseFloat(refMatch[1]) : 0;
    totalRef += keys * keyValue + ref;
  });
  return refinedToKeys(totalRef, keyValue);
};
