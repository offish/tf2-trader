<script lang="ts" setup>
defineProps({
  msg: String,
});
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <p>
      Thank you for using this extension!<br />
      Your support helps keep it free.
    </p>
    <a
      href="https://steamcommunity.com/tradeoffer/new/?partner=293059984&token=0-l_idZR"
      target="_blank"
      >Support the developer</a
    >
  </div>
</template>

<style scoped>
a {
  color: #67d45e;
  font-size: 16px;
}

a:hover {
  filter: drop-shadow(0 0 2em #54bc4ae0);
}
</style>
