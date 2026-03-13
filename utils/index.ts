import { UNUSUAL_EFFECTS } from "./data";

export const getEffectID = (value: string): number => {
  return UNUSUAL_EFFECTS[value];
};

export const getEffectURL = (value: number | string): string => {
  const effect = typeof value === "string" ? parseInt(value, 10) : value;
  return `https://itempedia.tf/assets/particles/${effect}_94x94.png`;
};
