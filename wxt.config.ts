import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  manifest: {
    name: "TF2 Trader",
    description: "Enhance Your Team Fortress 2 Trading Experience.",
    permissions: ["storage"],
    host_permissions: ["https://pricedb.io/*"],
  },
});
