import { Miniflare } from "miniflare";

const mf = new Miniflare({
    scriptPath: "./dist/index.js",
    compatibilityDate: "2024-07-29",
    compatibilityFlags: ["nodejs_compat"],
    port: 8080,
    host: "0.0.0.0",
    workers: [{
        name: "worker",
        modules: [{
            type: "ESModule",
            path: "./dist/index.js",
        }]
    }],
})
