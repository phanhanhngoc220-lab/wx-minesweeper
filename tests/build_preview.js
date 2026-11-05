const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = ["js/config.js", "js/ui.js", "js/core.js", "js/ads.js", "js/lobby.js", "js/minesweeper.js"];

let out = "(function(){\nconst __m = {};\n";
for (const f of files) {
    out += `__m[${JSON.stringify(f)}] = function(module, exports, require) {\n`;
    out += fs.readFileSync(path.join(root, f), "utf8");
    out += "\n};\n";
}
out += `function req(p) {
    p = p.replace(/^\\.\\//, "");
    if (!p.includes("/")) p = "js/" + p;
    if (!p.endsWith(".js")) p += ".js";
    const factory = __m[p];
    if (!factory) throw new Error("module not found: " + p);
    const module = { exports: {} };
    factory(module, module.exports, req);
    return module.exports;
}
`;
out += fs.readFileSync(path.join(__dirname, "preview.js"), "utf8");
out += "\n})();\n";

fs.writeFileSync(path.join(__dirname, "preview_bundle.js"), out);
console.log("bundle written", out.length);
