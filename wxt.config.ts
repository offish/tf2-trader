import { defineConfig } from "wxt";
import { version } from "./version";

export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  manifest: {
    name: "TF2 Trader",
    description: "Enhance Your Team Fortress 2 Trading Experience.",
    version: version,
    permissions: ["storage"],
  },
});
