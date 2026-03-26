<script lang="ts" setup>
import { ref, computed } from "vue";
import type { Settings, SiteKey, AutobotSiteKey } from "@/types";
import { saveSettings } from "@/utils/settings";

const props = defineProps<{ settings: Settings }>();
const emit = defineEmits<{ (e: "back"): void }>();

// Local copy so we can mutate reactively
const local = ref<Settings>(JSON.parse(JSON.stringify(props.settings)));

const SITE_LABELS: Record<SiteKey, string> = {
  backpackStats: "Backpack.tf Stats",
  backpackClassifieds: "Backpack.tf Classifieds",
  nextBackpackStats: "Next Backpack.tf Stats",
  nextBackpackClassifieds: "Next Backpack.tf Classifieds",
  steamInventory: "Steam Inventory",
  steamMarket: "Steam Market",
  steamTradeOfferNew: "Steam Trade Offer (New)",
  steamTradeOffer: "Steam Trade Offer",
  steamTradeOffers: "Steam Trade Offers",
  steamTradeHistory: "Steam Trade History",
  steamProfile: "Steam Profile",
  backpackProfile: "Backpack.tf Profile",
  marketplace: "Marketplace.tf",
  scrapTf: "Scrap.tf",
  stnTrading: "STN Trading",
};

const AUTOBOT_SITE_LABELS: Record<AutobotSiteKey, string> = {
  backpackStats: "Backpack.tf Stats",
  nextBackpackStats: "Next Backpack.tf Stats",
  pricedb: "PriceDB.io",
  steamMarket: "Steam Market",
  steamInventory: "Steam Inventory",
};

const siteKeys = Object.keys(SITE_LABELS) as SiteKey[];
const autobotSiteKeys = Object.keys(AUTOBOT_SITE_LABELS) as AutobotSiteKey[];

async function toggle(key: SiteKey) {
  local.value.sites[key] = !local.value.sites[key];
  await saveSettings(local.value);
}

async function toggleAutobotEnabled() {
  local.value.autobot.enabled = !local.value.autobot.enabled;
  await saveSettings(local.value);
}

async function toggleAutobotSite(key: AutobotSiteKey) {
  local.value.autobot.sites[key] = !local.value.autobot.sites[key];
  await saveSettings(local.value);
}
</script>

<template>
  <div class="settings-root">
    <div class="settings-header">
      <button class="back-btn" @click="emit('back')">&#8592; Back</button>
      <span class="settings-title">Settings</span>
    </div>

    <section class="section">
      <h2 class="section-title">Site Modifications</h2>
      <div class="toggle-list">
        <label v-for="key in siteKeys" :key="key" class="toggle-row">
          <span class="toggle-label">{{ SITE_LABELS[key] }}</span>
          <span
            class="toggle-switch"
            :class="{ on: local.sites[key] }"
            @click="toggle(key)"
          />
        </label>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Autobot</h2>
      <label class="toggle-row master-toggle">
        <span class="toggle-label">Enable Autobot Features</span>
        <span
          class="toggle-switch"
          :class="{ on: local.autobot.enabled }"
          @click="toggleAutobotEnabled"
        />
      </label>
      <div v-show="local.autobot.enabled" class="toggle-list autobot-sub">
        <p class="sub-hint">Show "Copy !add" buttons on these sites:</p>
        <label v-for="key in autobotSiteKeys" :key="key" class="toggle-row">
          <span class="toggle-label">{{ AUTOBOT_SITE_LABELS[key] }}</span>
          <span
            class="toggle-switch"
            :class="{ on: local.autobot.sites[key] }"
            @click="toggleAutobotSite(key)"
          />
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-root {
  padding: 8px 12px 16px;
  min-width: 300px;
  color: #ccc;
  font-size: 13px;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.back-btn {
  background: none;
  border: 1px solid #555;
  color: #ccc;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.back-btn:hover {
  border-color: #67d45e;
  color: #67d45e;
}

.settings-title {
  font-size: 15px;
  font-weight: 600;
  color: #eee;
}

.section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  margin: 0 0 8px;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.toggle-row:hover {
  background: #1e1e1e;
}

.master-toggle {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 6px 8px;
  margin-bottom: 6px;
}

.toggle-label {
  flex: 1;
  padding-right: 12px;
}

.toggle-switch {
  width: 32px;
  height: 17px;
  border-radius: 9px;
  background: #444;
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s;
}
.toggle-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #888;
  transition: transform 0.15s, background 0.15s;
}
.toggle-switch.on {
  background: #2a5c26;
}
.toggle-switch.on::after {
  transform: translateX(15px);
  background: #67d45e;
}

.autobot-sub {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 2px solid #333;
}

.sub-hint {
  font-size: 11px;
  color: #666;
  margin: 4px 0 6px;
}
</style>
