<script lang="ts" setup>
import { ref, onMounted } from "vue";
import Popup from "@/components/Popup.vue";
import SettingsView from "@/components/Settings.vue";
import { version } from "@/version";
import { getSettings } from "@/utils/settings";
import type { Settings } from "@/types";

const view = ref<"home" | "settings">("home");
const settings = ref<Settings | null>(null);

onMounted(async () => {
  settings.value = await getSettings();
});
</script>

<template>
  <div class="app-container">
    <div v-if="view === 'home'">
      <button class="gear-btn" title="Settings" @click="view = 'settings'">⚙</button>
      <div class="home-header">
        <a>
          <img src="/logo.svg" class="logo" alt="TF2 Trader Logo" />
        </a>
      </div>
      <Popup msg="TF2 Trader" :version="version" />
    </div>
    <div v-else-if="view === 'settings' && settings">
      <SettingsView :settings="settings" @back="view = 'home'" />
    </div>
  </div>
</template>

<style scoped>
.app-container {
  min-width: 300px;
  position: relative;
}

.home-header {
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #54bc4ae0);
}

.gear-btn {
  position: absolute;
  right: 10px;
  top: 10px;
  background: none;
  border: 1px solid #444;
  border-radius: 4px;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
  line-height: 1;
  transition: color 0.15s, border-color 0.15s;
}
.gear-btn:hover {
  color: #67d45e;
  border-color: #67d45e;
}
</style>
