const UI = require("./ui");
const core = require("./core");
const config = require("./config");

const C = UI.colors;

class Minesweeper {
    constructor(app, diff) {
        this.app = app;
        this.diff = diff;
        this.rows = diff.rows;
        this.cols = diff.cols;
        this.mineCount = diff.mines;
        this.total = this.rows * this.cols;

        this.board = null;
        this.nb = null;
        this.mine = null;
        this.num = null;
        this.revealed = null;
        this.flagged = null;
        this.revealedCount = 0;
        this.flags = 0;

        this.status = "ready"; // ready | generating | playing | won | lost
        this.startedAt = 0;
        this.elapsed = 0;
        this.gen = null;
        this.genAttempts = 0;
        this.genTimer = null;

        this.hintCells = [];
        this.hintUntil = 0;
        this.revived = false;
        this.overlayRect = null;
        this.buttons = {};
        this.cellRects = [];
        this.boardRect = { x: 0, y: 0, w: 0, h: 0 };

        this.pressTimer = null;
        this.pressCell = -1;
        this.longFired = false;
        this.swipeFlagged = false;
        this.pressStart = 0;

        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.pinch = null;
        this.dragging = false;
        this.downX = 0;
        this.downY = 0;
        this.lastX = 0;
        this.lastY = 0;
        this.lastTapAt = 0;
        this.lastTapPos = null;

        this.reset();
    }

    enter() {
        this.layout(this.app.W, this.app.H);
    }

    exit() {
        this.clearGen();
        if (this.pressTimer) clearTimeout(this.pressTimer);
    }

    layout(W, H) {
        const pad = 14;
        const maxBoardW = W - pad * 2;
        const top = 96;
        const bottom = 150;
        const maxBoardH = H - top - bottom;
        const gap = this.cols > 20 ? 1 : 2;
        const cellW = Math.floor((maxBoardW - (this.cols - 1) * gap) / this.cols);
        const cellH = Math.floor((maxBoardH - (this.rows - 1) * gap) / this.rows);
        const cell = Math.max(10, Math.min(44, cellW, cellH));
        this.cell = cell;
        this.gap = gap;
        const bw = cell * this.cols + (this.cols - 1) * gap;
        const bh = cell * this.rows + (this.rows - 1) * gap;
        this.boardRect = {
            x: (W - bw) / 2,
            y: top + Math.max(0, (maxBoardH - bh) / 2),
            w: bw,
            h: bh
        };
        this.backRect = { x: 16, y: 40, w: 74, h: 36 };
        this.hintRect = { x: W - 176, y: H - 96, w: 76, h: 40 };
        this.resetRect = { x: W - 92, y: H - 96, w: 76, h: 40 };
    }

    boardReady() {
        return !!this.board;
    }

    reset() {
        this.clearGen();
        this.board = null;
        this.nb = null;
        this.mine = null;
        this.num = null;
        this.revealed = new Uint8Array(this.total);
        this.flagged = new Uint8Array(this.total);
        this.revealedCount = 0;
        this.flags = 0;
        this.status = "ready";
        this.elapsed = 0;
        this.startedAt = 0;
        this.hintCells = [];
        this.revived = false;
        this.genAttempts = 0;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.pinch = null;
        this.dragging = false;
        this.layout(this.app.W, this.app.H);
    }

    clearGen() {
        if (this.genTimer) { clearTimeout(this.genTimer); this.genTimer = null; }
    }

    startGeneration(startIdx) {
        this.status = "generating";
        this.gen = core.createGenerator(this.rows, this.cols, this.mineCount, startIdx);
        this.genAttempts = 0;
        this.startIdx = startIdx;
        const step = () => {
            const t0 = Date.now();
            const res = this.gen.step(28);
            this.genAttempts = res.attempts;
            if (res.done) {
                this.applyBoard(res.board, res.nb);
                this.genTimer = null;
                return;
            }
            if (Date.now() - t0 > 2000) {
                this.status = "ready";
                this.app.toast("生成超时，请再试一次");
                return;
            }
            this.genTimer = setTimeout(step, 0);
        };
        this.genTimer = setTimeout(step, 0);
    }

    applyBoard(board, nb) {
        this.board = board;
        this.nb = nb;
        this.mine = board.mine;
        this.num = board.num;
        this.revealed = new Uint8Array(this.total);
        this.flagged = new Uint8Array(this.total);
        this.revealedCount = 0;
        this.flags = 0;
        this.status = "playing";
        this.startedAt = Date.now();
        this.revealCell(this.startIdx);
    }
    _pt(e, y) {
        if (typeof e === "number") return { x: e, y: y };
        const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        if (!t) return { x: -1, y: -1 };
        return { x: t.clientX, y: t.clientY };
    }

    _local(x, y) {
        return { x: (x - this.panX) / this.zoom, y: (y - this.panY) / this.zoom };
    }

    idxAt(x, y) {
        const p = this._local(x, y);
        const b = this.boardRect;
        if (p.x < b.x || p.y < b.y || p.x > b.x + b.w || p.y > b.y + b.h) return -1;
        const step = this.cell + this.gap;
        const c = Math.floor((p.x - b.x) / step);
        const r = Math.floor((p.y - b.y) / step);
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return -1;
        return r * this.cols + c;
    }

    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.pinch = null;
    }

    clampView() {
        const W = this.app.W, H = this.app.H;
        const b = this.boardRect;
        const z = this.zoom;
        const bw = b.w * z, bh = b.h * z;
        const pad = 8;
        const top = 96;
        const bottom = H - 112;
        if (bw <= W - pad * 2) {
            this.panX = (W - bw) / 2 - b.x * z;
        } else {
            this.panX = Math.min(pad - b.x * z, Math.max(W - pad - (b.x + b.w) * z, this.panX));
        }
        if (bh <= bottom - top - pad * 2) {
            this.panY = (top + bottom - bh) / 2 - b.y * z;
        } else {
            this.panY = Math.min(top + pad - b.y * z, Math.max(bottom - pad - (b.y + b.h) * z, this.panY));
        }
    }

    beginPinch(touches) {
        if (this.pressTimer) { clearTimeout(this.pressTimer); this.pressTimer = null; }
        const a = touches[0], b = touches[1];
        const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
        this.pinch = {
            dist: Math.max(1, Math.sqrt(dx * dx + dy * dy)),
            midX: (a.clientX + b.clientX) / 2,
            midY: (a.clientY + b.clientY) / 2,
            zoom: this.zoom,
            panX: this.panX,
            panY: this.panY
        };
        this.dragging = false;
    }

    movePinch(touches) {
        const a = touches[0], b = touches[1];
        const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const midX = (a.clientX + b.clientX) / 2;
        const midY = (a.clientY + b.clientY) / 2;
        const p = this.pinch;
        let z = p.zoom * (dist / p.dist);
        z = Math.max(1, Math.min(4, z));
        const k = z / p.zoom;
        this.panX = midX - (p.midX - p.panX) * k;
        this.panY = midY - (p.midY - p.panY) * k;
        this.zoom = z;
        this.clampView();
    }

    onTouchStart(e, y) {
        const touches = e && e.touches;
        if (touches && touches.length >= 2) { this.beginPinch(touches); return; }
        const p = this._pt(e, y);
        this.downX = p.x; this.downY = p.y;
        this.lastX = p.x; this.lastY = p.y;
        this.dragging = false;
        this.swipeFlagged = false;
        this.longFired = false;
        this.pressCell = this.status === "playing" ? this.idxAt(p.x, p.y) : -1;
    }

    onTouchMove(e) {
        const touches = e && e.touches;
        if (this.pinch) {
            if (touches && touches.length >= 2) this.movePinch(touches);
            return;
        }
        const p = this._pt(e);
        if (p.x < 0) return;
        const dx = p.x - this.lastX, dy = p.y - this.lastY;
        const totalX = p.x - this.downX;
        const totalY = p.y - this.downY;
        const dist = Math.sqrt(totalX * totalX + totalY * totalY);

        // 下滑插旗：以竖直向下为主，且起点是未翻开的格子
        if (!this.swipeFlagged && !this.dragging && this.pressCell >= 0 &&
            totalY > 14 && totalY > Math.abs(totalX) * 1.3 && dist < 130 &&
            !this.revealed[this.pressCell]) {
            this.swipeFlagged = true;
            this.toggleFlag(this.pressCell);
            this.lastX = p.x;
            this.lastY = p.y;
            return;
        }

        if (!this.dragging && dist > 7) {
            this.dragging = true;
        }
        if (this.dragging && this.zoom > 1) {
            this.panX += dx;
            this.panY += dy;
            this.clampView();
        }
        this.lastX = p.x;
        this.lastY = p.y;
    }

    onTouchEnd(e, y) {
        if (this.pinch) {
            if (e && e.touches && e.touches.length >= 2) return;
            this.pinch = null;
            return;
        }
        if (this.swipeFlagged) { this.swipeFlagged = false; this.dragging = false; return; }

        // 兜底：1× 时快速下滑可能一次位移就超过阈值，在抬手时再判定一次
        if (this.zoom <= 1.01 && this.pressCell >= 0 && !this.revealed[this.pressCell]) {
            const pend = this._pt(e, y);
            const tdx = pend.x - this.downX;
            const tdy = pend.y - this.downY;
            if (tdy > 24 && tdy > Math.abs(tdx) * 1.3) {
                this.dragging = false;
                this.toggleFlag(this.pressCell);
                return;
            }
        }

        if (this.dragging) { this.dragging = false; return; }
        if (this.status === "generating") return;

        const p = this._pt(e, y);
        const x = p.x, yy = p.y;

        if (UI.hit(this.backRect, x, yy)) { this.app.setScene("lobby"); return; }
        if (this.status === "playing" && UI.hit(this.hintRect, x, yy)) { this.showHint(); return; }
        if (UI.hit(this.resetRect, x, yy)) { this.reset(); return; }

        if (this.status === "won" || this.status === "lost") {
            const b = this.buttons;
            if (b.again && UI.hit(b.again, x, yy)) { this.restart(); return; }
            if (b.lobby && UI.hit(b.lobby, x, yy)) { this.app.setScene("lobby"); return; }
            if (this.status === "lost" && b.revive && UI.hit(b.revive, x, yy)) {
                this.tryRevive();
                return;
            }
            return;
        }

        const now = Date.now();
        if (this.zoom > 1 && this.lastTapPos && now - this.lastTapAt < 300) {
            const d = Math.hypot(x - this.lastTapPos.x, yy - this.lastTapPos.y);
            if (d < 26) {
                this.resetZoom();
                this.lastTapAt = 0;
                this.lastTapPos = null;
                return;
            }
        }
        this.lastTapAt = now;
        this.lastTapPos = { x, y: yy };

        const idx = this.idxAt(x, yy);
        if (idx < 0) return;

        if (this.status === "ready") { this.startGeneration(idx); return; }
        if (this.status !== "playing") return;

        if (this.revealed[idx]) this.chord(idx);
        else this.revealCell(idx);
    }

    restart() {
        this.reset();
        this.startGeneration((this.rows * this.cols) >> 1);
    }

    flood(start) {
        const stack = [start];
        while (stack.length) {
            const x = stack.pop();
            if (this.revealed[x] || this.flagged[x]) continue;
            this.revealed[x] = 1;
            this.revealedCount++;
            if (this.num[x] === 0) {
                for (const j of this.nb[x]) {
                    if (!this.revealed[j] && !this.flagged[j] && !this.mine[j]) stack.push(j);
                }
            }
        }
    }

    revealCell(idx) {
        if (this.status !== "playing") return;
        if (this.revealed[idx] || this.flagged[idx]) return;
        if (this.mine[idx]) { this.lose(idx); return; }
        this.flood(idx);
        this.checkWin();
    }

    toggleFlag(idx) {
        if (this.status !== "playing" || this.revealed[idx]) return;
        this.flagged[idx] = this.flagged[idx] ? 0 : 1;
        this.flags += this.flagged[idx] ? 1 : -1;
    }

    chord(idx) {
        if (this.status !== "playing" || !this.revealed[idx]) return;
        const n = this.num[idx];
        if (n <= 0) return;
        let flags = 0;
        for (const j of this.nb[idx]) if (this.flagged[j]) flags++;
        if (flags !== n) return;
        for (const j of this.nb[idx]) {
            if (!this.flagged[j] && !this.revealed[j]) {
                if (this.mine[j]) { this.lose(j); return; }
                this.flood(j);
            }
        }
        this.checkWin();
    }

    lose(idx) {
        if (this.status !== "playing") return;
        this.status = "lost";
        this.exploded = idx;
        this.revealed[idx] = 1;
        for (let i = 0; i < this.total; i++) if (this.mine[i]) this.revealed[i] = 1;
    }

    tryRevive() {
        if (this.revived || this.status !== "lost") return;
        const ad = this.app.ads;
        if (!ad.hasRewarded()) { this.app.toast("广告位未配置，开发模式不可复活"); return; }
        ad.showRewarded().then((ok) => {
            if (!ok) { this.app.toast("完整观看广告才能复活"); return; }
            this.revived = true;
            this.reviveNow();
        });
    }

    reviveNow() {
        const from = this.exploded;
        let to = -1;
        for (let i = 0; i < this.total; i++) {
            if (!this.mine[i] && !this.revealed[i]) { to = i; break; }
        }
        if (to < 0) return;
        this.mine[from] = 0;
        this.mine[to] = 1;
        for (let i = 0; i < this.total; i++) {
            if (this.mine[i]) { this.num[i] = -1; continue; }
            let n = 0;
            for (const j of this.nb[i]) n += this.mine[j];
            this.num[i] = n;
        }
        this.status = "playing";
        this.flood(from);
        this.checkWin();
    }

    checkWin() {
        if (this.revealedCount === this.total - this.mineCount) {
            this.status = "won";
            this.elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
            this.app.saveBest(this.diff.key, this.elapsed);
        }
    }

    logicalMove() {
        const cons = core.buildConstraints(this.revealed, this.flagged, this.nb, this.num);
        for (const c of cons) {
            if (c.need === 0) return { safe: c.cells.slice() };
            if (c.need === c.cells.length) return { mines: c.cells.slice() };
        }
        for (let i = 0; i < cons.length; i++) {
            const a = cons[i];
            const aSet = new Set(a.cells);
            for (let j = 0; j < cons.length; j++) {
                if (i === j) continue;
                const b = cons[j];
                if (b.cells.length <= a.cells.length) continue;
                let subset = true;
                for (const x of a.cells) if (!b.cells.includes(x)) { subset = false; break; }
                if (!subset) continue;
                const diff = b.cells.filter(x => !aSet.has(x));
                const dn = b.need - a.need;
                if (dn === 0) return { safe: diff };
                if (dn === diff.length) return { mines: diff };
            }
        }
        for (const comp of core.buildComponents(cons)) {
            if (comp.vars.length > 20) continue;
            const forced = core.enumerateComponent(comp);
            if (!forced) continue;
            if (forced.safe.length) return { safe: forced.safe };
            if (forced.mines.length) return { mines: forced.mines };
        }
        return null;
    }

    showHint() {
        if (this.status !== "playing") return;
        const move = this.logicalMove();
        if (!move) {
            this.app.toast("暂无可推导格子（检查一下旗子）");
            return;
        }
        this.hintCells = move.safe || move.mines;
        this.hintUntil = Date.now() + 2200;
        this.app.toast(move.safe ? "高亮格子一定安全" : "高亮格子一定是雷");
    }

    currentElapsed() {
        if (this.status === "playing") return Math.floor((Date.now() - this.startedAt) / 1000);
        return this.elapsed;
    }

    draw(ctx, W, H) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, C.bg1);
        g.addColorStop(1, C.bg0);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // 顶栏
        UI.fillRound(ctx, this.backRect.x, this.backRect.y, this.backRect.w, this.backRect.h, 10, "rgba(255,255,255,0.06)");
        UI.text(ctx, "‹ 大厅", this.backRect.x + this.backRect.w / 2, this.backRect.y + this.backRect.h / 2, 14, C.text, "center");

        UI.text(ctx, this.diff.name + " · " + this.cols + "×" + this.rows, W / 2, 58, 18, C.text, "center", "bold");
        UI.text(ctx, "🚩 " + (this.mineCount - this.flags) + "    ⏱ " + UI.formatTime(this.currentElapsed()),
            W / 2, 84, 14, C.muted, "center");

        // 棋盘（支持双指缩放 / 拖动）
        const b = this.boardRect;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 92, W, H - 92 - 104);
        ctx.clip();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        UI.fillRound(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 12, "rgba(20,31,58,0.85)");
        UI.strokeRound(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 12, C.line, 1);

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const idx = r * this.cols + c;
                const x = b.x + c * (this.cell + this.gap);
                const y = b.y + r * (this.cell + this.gap);
                this.drawCell(ctx, idx, x, y);
            }
        }

        if (this.hintCells.length && Date.now() < this.hintUntil) {
            for (const idx of this.hintCells) {
                const r = Math.floor(idx / this.cols), c = idx % this.cols;
                const x = b.x + c * (this.cell + this.gap);
                const y = b.y + r * (this.cell + this.gap);
                UI.strokeRound(ctx, x, y, this.cell, this.cell, 5, C.accent2, 2);
            }
        } else if (this.hintCells.length) {
            this.hintCells = [];
        }
        ctx.restore();

        // 底栏按钮
        if (this.status === "playing" || this.status === "ready" || this.status === "generating") {
            UI.button(ctx, this.hintRect, "提示", { size: 15 });
            UI.button(ctx, this.resetRect, "重开", { size: 15 });
            UI.text(ctx, "下滑插旗 · 双指缩放 · 双击复位", W / 2, H - 76, 12, C.muted, "center");
        }

        // 状态浮层
        if (this.status === "generating") this.drawGenerating(ctx, W, H);
        if (this.status === "won") this.drawResult(ctx, W, H, true);
        if (this.status === "lost") this.drawResult(ctx, W, H, false);

        if (this.zoom > 1.01) {
            UI.fillRound(ctx, 12, H - 150, 112, 26, 13, "rgba(10,16,32,0.85)");
            UI.text(ctx, "×" + this.zoom.toFixed(1) + "  双击复位", 68, H - 137, 11, C.muted, "center");
        }
    }

    drawCell(ctx, idx, x, y) {
        const size = this.cell;
        if (this.revealed[idx]) {
            const isMine = this.mine[idx];
            const exploded = this.status === "lost" && idx === this.exploded;
            UI.fillRound(ctx, x, y, size, size, 5, exploded ? "#3a1720" : C.cellOpen);
            if (isMine) {
                UI.text(ctx, "💣", x + size / 2, y + size / 2, size * 0.55, "#ffb3b3", "center");
            } else if (this.num[idx] > 0) {
                const colors = ["", "#6ea8ff", "#46d39a", "#ff7b7b", "#b18cff", "#ffb020", "#43d6d6", "#ff8ad1", "#c7d3ea"];
                UI.text(ctx, String(this.num[idx]), x + size / 2, y + size / 2, size * 0.52,
                    colors[this.num[idx]], "center", "bold");
            }
        } else {
            const g = ctx.createLinearGradient(0, y, 0, y + size);
            g.addColorStop(0, C.cellTop);
            g.addColorStop(1, C.cellBottom);
            UI.fillRound(ctx, x, y, size, size, 5, g);
            UI.strokeRound(ctx, x, y, size, size, 5, "rgba(255,255,255,0.05)", 1);
            if (this.flagged[idx]) {
                UI.text(ctx, "🚩", x + size / 2, y + size / 2, size * 0.5, "#ffd166", "center");
            }
        }
    }

    drawGenerating(ctx, W, H) {
        ctx.fillStyle = "rgba(5,9,18,0.72)";
        ctx.fillRect(0, 0, W, H);
        UI.fillRound(ctx, W / 2 - 130, H / 2 - 60, 260, 120, 16, "rgba(20,31,58,0.95)");
        UI.text(ctx, "正在生成无猜棋盘…", W / 2, H / 2 - 16, 16, C.text, "center", "bold");
        UI.text(ctx, "已尝试 " + this.genAttempts + " 个布局", W / 2, H / 2 + 16, 13, C.muted, "center");
    }

    drawResult(ctx, W, H, won) {
        ctx.fillStyle = "rgba(5,9,18,0.75)";
        ctx.fillRect(0, 0, W, H);
        const pw = Math.min(320, W - 48);
        const ph = won ? 220 : 260;
        const px = (W - pw) / 2, py = (H - ph) / 2;
        UI.fillRound(ctx, px, py, pw, ph, 18, "rgba(20,31,58,0.98)");
        UI.strokeRound(ctx, px, py, pw, ph, 18, C.line, 1);

        UI.text(ctx, won ? "通关" : "踩雷了", W / 2, py + 48, 22, won ? C.accent2 : C.danger, "center", "bold");
        UI.text(ctx, won ? "用时 " + UI.formatTime(this.elapsed) + "，全程没有猜测" : "这局棋盘本身是无猜的，再试一次",
            W / 2, py + 86, 13, C.muted, "center");

        const bw = 120, bh = 42, gap = 12;
        const by = py + ph - 66;

        if (!won && this.app.ads.hasRewarded() && !this.revived) {
            const rw = 200;
            const rx = (W - rw) / 2;
            const ry = py + 118;
            this.buttons.revive = { x: rx, y: ry, w: rw, h: 40 };
            UI.button(ctx, this.buttons.revive, "看广告复活", { primary: true, size: 15 });
        } else {
            this.buttons.revive = null;
        }

        const totalW = bw * 2 + gap;
        const bx = (W - totalW) / 2;
        this.buttons.again = { x: bx, y: by, w: bw, h: bh };
        this.buttons.lobby = { x: bx + bw + gap, y: by, w: bw, h: bh };
        UI.button(ctx, this.buttons.again, "再来一局", { primary: true, size: 15 });
        UI.button(ctx, this.buttons.lobby, "回大厅", { size: 15 });
    }
}

module.exports = Minesweeper;
