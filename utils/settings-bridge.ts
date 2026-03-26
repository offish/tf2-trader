import type { Settings } from "@/types";
import { DEFAULT_SETTINGS } from "./settings";

/**
 * Fetch settings from the ISOLATED-world settings bridge via window.postMessage.
 * For use ONLY from world: "MAIN" content scripts where browser.storage is unavailable.
 * Falls back to DEFAULT_SETTINGS on timeout.
 */
export function getSettingsFromBridge(
  timeoutMs = 500,
): Promise<Settings> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(DEFAULT_SETTINGS);
    }, timeoutMs);
    const handler = (e: MessageEvent) => {
      if (
        e.data?.type === "tf2trader_settings_response" &&
        e.data?.id === id
      ) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(e.data.settings ?? DEFAULT_SETTINGS);
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "tf2trader_settings_request", id }, "*");
  });
}
