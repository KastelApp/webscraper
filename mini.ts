import { Miniflare } from "miniflare";

const mf = new Miniflare({
    cache: true,
    scriptPath: "./dist/index.js",
    compatibilityDate: "2024-07-29",
    compatibilityFlags: ["nodejs_compat"],
    port: 8080
})
