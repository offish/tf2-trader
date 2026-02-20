<script lang="ts" setup>
import Popup from "@/components/Popup.vue";
</script>

<template>
  <div>
    <a href="https://steamcommunity.com/id/confern" target="_blank">
      <img src="/logo.svg" class="logo" alt="TF2 Trader Logo" />
    </a>
  </div>
  <Popup msg="TF2 Trader" />
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #54bc4ae0);
}
</style>
