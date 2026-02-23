import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  manifest: {
    name: "TF2 Trader",
    description: "Enhance Your Team Fortress 2 Trading Experience.",
    version: "0.1.0",
    permissions: ["storage"],
  },
});
