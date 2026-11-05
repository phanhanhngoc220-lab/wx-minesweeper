/** Canvas 绘制与布局小工具 */
const UI = {
    colors: {
        bg0: "#070c18",
        bg1: "#0f1a33",
        panel: "#141f3a",
        panel2: "#1a2745",
        line: "rgba(120,150,210,0.22)",
        text: "#e8eefc",
        muted: "#93a4c8",
        accent: "#5b8cff",
        accent2: "#22d3a6",
        danger: "#ff6b6b",
        warn: "#ffb020",
        cellTop: "#2b3a5e",
        cellBottom: "#1a2540",
        cellOpen: "#0d1526"
    },

    roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },

    fillRound(ctx, x, y, w, h, r, color) {
        UI.roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = color;
        ctx.fill();
    },

    strokeRound(ctx, x, y, w, h, r, color, width) {
        UI.roundRect(ctx, x, y, w, h, r);
        ctx.strokeStyle = color;
        ctx.lineWidth = width || 1;
        ctx.stroke();
    },

    text(ctx, str, x, y, size, color, align, weight) {
        ctx.font = (weight ? weight + " " : "") + size + "px sans-serif";
        ctx.fillStyle = color;
        ctx.textAlign = align || "left";
        ctx.textBaseline = "middle";
        ctx.fillText(str, x, y);
    },

    button(ctx, rect, label, opts) {
        opts = opts || {};
        const { x, y, w, h } = rect;
        if (opts.primary) {
            const g = ctx.createLinearGradient(0, y, 0, y + h);
            g.addColorStop(0, "#4f7ff0");
            g.addColorStop(1, "#365fc4");
            UI.fillRound(ctx, x, y, w, h, opts.radius || 12, g);
        } else {
            UI.fillRound(ctx, x, y, w, h, opts.radius || 12, "rgba(255,255,255,0.06)");
            UI.strokeRound(ctx, x, y, w, h, opts.radius || 12, "rgba(120,150,210,0.25)", 1);
        }
        UI.text(ctx, label, x + w / 2, y + h / 2, opts.size || 16,
            opts.color || (opts.primary ? "#fff" : UI.colors.text), "center", opts.weight || "");
    },

    hit(rect, x, y) {
        return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    },

    formatTime(sec) {
        const m = String(Math.floor(sec / 60)).padStart(2, "0");
        const s = String(sec % 60).padStart(2, "0");
        return m + ":" + s;
    }
};

module.exports = UI;
