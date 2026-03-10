import { UNUSUAL_EFFECTS } from "./data";

export const getEffectID = (value: string): number => {
  return UNUSUAL_EFFECTS[value];
};

export const getEffectURL = (value: number): string => {
  return `https://itempedia.tf/assets/particles/${value}_94x94.png`;
};
