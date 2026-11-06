const UI = require("./ui");
const config = require("./config");

const C = UI.colors;

class Lobby {
    constructor(app) {
        this.app = app;
        this.selected = app.lastDiff || "beginner";
        this.cards = [
            { id: "mine", name: "扫雷 · 无猜", desc: "逻辑推演，不用猜", ready: true },
            { id: "2048", name: "2048", desc: "开发中", ready: false },
            { id: "snake", name: "贪吃蛇", desc: "开发中", ready: false }
        ];
        this.layout(app.W, app.H);
    }

    enter() { this.layout(this.app.W, this.app.H); }
    exit() {}

    layout(W, H) {
        this.chips = [];
        const pad = 16;
        const gap = 8;
        const landscape = W > H;
        this.landscape = landscape;
        const cols = landscape ? 5 : 3;
        const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
        const ch = landscape ? 54 : 52;
        const top = landscape ? 92 : 196;
        config.DIFFS.forEach((d, i) => {
            const r = Math.floor(i / cols), c = i % cols;
            this.chips.push({
                diff: d,
                rect: { x: pad + c * (cw + gap), y: top + r * (ch + gap), w: cw, h: ch }
            });
        });
        const rows = Math.ceil(config.DIFFS.length / cols);
        const chipsBottom = top + rows * (ch + gap);

        this.orientRect = { x: W - 78, y: landscape ? 60 : 150, w: 64, h: 30 };
        this.startRect = landscape
            ? { x: pad, y: chipsBottom + 26, w: W - pad * 2, h: 46 }
            : { x: pad, y: chipsBottom + 18, w: W - pad * 2, h: 54 };

        this.cardsTop = this.startRect.y + this.startRect.h + (landscape ? 16 : 34);
        if (landscape) {
            const cgap = 10;
            const cw2 = (W - pad * 2 - cgap * 2) / 3;
            this.cardRects = this.cards.map((c, i) => ({
                card: c,
                rect: { x: pad + i * (cw2 + cgap), y: this.cardsTop, w: cw2, h: Math.min(72, H - this.cardsTop - 10) }
            }));
        } else {
            this.cardRects = this.cards.map((c, i) => ({
                card: c,
                rect: { x: pad, y: this.cardsTop + i * 74, w: W - pad * 2, h: 64 }
            }));
        }
    }

    onTouchStart() {}
    onTouchMove() {}

    onTouchEnd(e, y) {
        let x = e, yy = y;
        if (typeof e !== "number") {
            const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
            if (!t) return;
            x = t.clientX;
            yy = t.clientY;
        }
        if (UI.hit(this.orientRect, x, yy)) { if (this.app.toggleOrientation) this.app.toggleOrientation(); return; }
        for (const chip of this.chips) {
            if (UI.hit(chip.rect, x, yy)) {
                this.selected = chip.diff.key;
                this.app.lastDiff = chip.diff.key;
                return;
            }
        }
        if (UI.hit(this.startRect, x, yy)) {
            this.start();
            return;
        }
        for (const item of this.cardRects) {
            if (UI.hit(item.rect, x, yy)) {
                if (item.card.id === "mine") this.start();
                else this.app.toast(item.card.name + " 正在开发中");
                return;
            }
        }
    }

    start() {
        const diff = config.DIFFS.find(d => d.key === this.selected) || config.DIFFS[1];
        this.app.startGame(diff);
    }

    draw(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, C.bg1);
        g.addColorStop(1, C.bg0);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        UI.text(ctx, "🎮 " + config.APP_NAME, W / 2, this.landscape ? 40 : 72, this.landscape ? 22 : 26, C.text, "center", "bold");
        UI.text(ctx, config.SUBTITLE, W / 2, this.landscape ? 62 : 106, 13, C.muted, "center");

        UI.button(ctx, this.orientRect, this.landscape ? "竖屏" : "横屏", { size: 12 });

        UI.text(ctx, "选择难度", 16, this.landscape ? 80 : 160, 14, C.muted, "left");

        for (const chip of this.chips) {
            const active = chip.diff.key === this.selected;
            const r = chip.rect;
            if (active) {
                const gg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
                gg.addColorStop(0, "#4f7ff0");
                gg.addColorStop(1, "#365fc4");
                UI.fillRound(ctx, r.x, r.y, r.w, r.h, 10, gg);
            } else {
                UI.fillRound(ctx, r.x, r.y, r.w, r.h, 10, "rgba(255,255,255,0.05)");
                UI.strokeRound(ctx, r.x, r.y, r.w, r.h, 10, C.line, 1);
            }
            UI.text(ctx, chip.diff.name, r.x + r.w / 2, r.y + 18, 15,
                active ? "#fff" : C.text, "center", "bold");
            UI.text(ctx, chip.diff.cols + "×" + chip.diff.rows + " · " + chip.diff.mines + "雷",
                r.x + r.w / 2, r.y + 37, 11, active ? "rgba(255,255,255,0.8)" : C.muted, "center");
        }

        const best = this.app.getBest(this.selected);
        UI.text(ctx, best ? "最佳用时 " + UI.formatTime(best) : "还没有记录，来一局？",
            W / 2, this.startRect.y - 12, 12, C.muted, "center");

        UI.button(ctx, this.startRect, "开始游戏", { primary: true, size: 18 });

        UI.text(ctx, "游戏库", 16, this.cardsTop - 18, 14, C.muted, "left");
        for (const item of this.cardRects) {
            const r = item.rect;
            UI.fillRound(ctx, r.x, r.y, r.w, r.h, 12, "rgba(20,31,58,0.9)");
            UI.strokeRound(ctx, r.x, r.y, r.w, r.h, 12, C.line, 1);
            UI.text(ctx, item.card.name, r.x + 16, r.y + 24, 16,
                item.card.ready ? C.text : C.muted, "left", "bold");
            UI.text(ctx, item.card.desc, r.x + 16, r.y + 45, 12, C.muted, "left");
            UI.text(ctx, item.card.ready ? "开始" : "敬请期待",
                r.x + r.w - 16, r.y + r.h / 2, 13,
                item.card.ready ? C.accent2 : C.muted, "right");
        }

        UI.text(ctx, "无猜模式：生成前会验证整盘可纯逻辑通关", W / 2, H - (this.landscape ? 16 : 28), 11, "rgba(147,164,200,0.7)", "center");
    }
}

module.exports = Lobby;
