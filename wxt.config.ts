import { defineConfig, defineWebExtConfig } from "wxt";

// See https://wxt.dev/api/config.html
const config = defineConfig({
  modules: ["@wxt-dev/module-vue"],
});

const webExtConfig = defineWebExtConfig({
  disabled: true,
});

export default {
  ...config,
  webExt: webExtConfig,
};
