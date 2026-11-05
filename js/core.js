/**
 * 扫雷核心：棋盘生成 + 无猜求解器
 * 与网页版算法一致：单点规则 -> 子集规则 -> 连通分量穷举
 */
(function (root) {
    "use strict";

    function buildNeighbors(rows, cols) {
        const nb = new Array(rows * cols);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const list = [];
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const rr = r + dr, cc = c + dc;
                        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) list.push(rr * cols + cc);
                    }
                }
                nb[r * cols + c] = list;
            }
        }
        return nb;
    }

    function randomBoard(nb, total, mines, safeSet) {
        const pool = [];
        for (let i = 0; i < total; i++) if (!safeSet.has(i)) pool.push(i);
        for (let i = pool.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
        }
        const mine = new Uint8Array(total);
        for (let i = 0; i < mines; i++) mine[pool[i]] = 1;
        const num = new Int8Array(total);
        for (let i = 0; i < total; i++) {
            if (mine[i]) { num[i] = -1; continue; }
            let n = 0;
            for (const j of nb[i]) n += mine[j];
            num[i] = n;
        }
        return { mine, num };
    }

    function buildConstraints(revealed, flagged, nb, num) {
        const cons = [];
        for (let i = 0; i < revealed.length; i++) {
            if (!revealed[i]) continue;
            let need = num[i];
            const cells = [];
            for (const j of nb[i]) {
                if (flagged[j]) need--;
                else if (!revealed[j]) cells.push(j);
            }
            if (cells.length) cons.push({ cells, need });
        }
        return cons;
    }

    function solve(board, nb, total, mineCount, start) {
        const { num, mine } = board;
        const revealed = new Uint8Array(total);
        const flagged = new Uint8Array(total);
        let revealedCount = 0;

        function reveal(startIdx) {
            const stack = [startIdx];
            while (stack.length) {
                const x = stack.pop();
                if (revealed[x] || flagged[x]) continue;
                revealed[x] = 1; revealedCount++;
                if (num[x] === 0) {
                    for (const j of nb[x]) {
                        if (!revealed[j] && !mine[j] && !flagged[j]) stack.push(j);
                    }
                }
            }
        }

        reveal(start);
        const target = total - mineCount;
        let guard = 0;

        while (revealedCount < target) {
            if (++guard > total * 40) return false;
            const cons = buildConstraints(revealed, flagged, nb, num);
            let moved = false;

            for (const c of cons) {
                if (c.need === 0) { c.cells.forEach(reveal); moved = true; break; }
                if (c.need === c.cells.length) { c.cells.forEach(x => flagged[x] = 1); moved = true; break; }
            }
            if (moved) continue;

            for (let i = 0; i < cons.length && !moved; i++) {
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
                    if (dn === 0) { diff.forEach(reveal); moved = true; break; }
                    if (dn === diff.length) { diff.forEach(x => flagged[x] = 1); moved = true; break; }
                }
            }
            if (moved) continue;

            for (const comp of buildComponents(cons)) {
                if (comp.vars.length > 20) continue;
                const forced = enumerateComponent(comp);
                if (!forced) continue;
                if (forced.mines.length) { forced.mines.forEach(x => flagged[x] = 1); moved = true; }
                if (forced.safe.length) { forced.safe.forEach(reveal); moved = true; }
                if (moved) break;
            }
            if (moved) continue;
            return false;
        }
        return true;
    }

    function buildComponents(cons) {
        const comps = [];
        const used = new Array(cons.length).fill(false);
        for (let i = 0; i < cons.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            const vars = new Set(cons[i].cells);
            const idxs = [i];
            let changed = true;
            while (changed) {
                changed = false;
                for (let j = 0; j < cons.length; j++) {
                    if (used[j]) continue;
                    if (cons[j].cells.some(x => vars.has(x))) {
                        used[j] = true; idxs.push(j);
                        cons[j].cells.forEach(x => vars.add(x));
                        changed = true;
                    }
                }
            }
            comps.push({ vars: Array.from(vars), cons: idxs.map(k => cons[k]) });
        }
        return comps;
    }

    function enumerateComponent(comp, nodeCap) {
        nodeCap = nodeCap || 200000;
        const vars = comp.vars;
        const index = new Map(vars.map((v, i) => [v, i]));
        const cons = comp.cons.map(c => ({ idx: c.cells.map(x => index.get(x)), need: c.need }));
        const canBe1 = new Array(vars.length).fill(false);
        const canBe0 = new Array(vars.length).fill(false);
        const assign = new Int8Array(vars.length).fill(-1);
        let nodes = 0;

        function partialOk() {
            for (const c of cons) {
                let sum = 0, unknown = 0;
                for (const k of c.idx) {
                    if (assign[k] === 1) sum++;
                    else if (assign[k] === -1) unknown++;
                }
                if (sum > c.need || sum + unknown < c.need) return false;
            }
            return true;
        }

        function dfs(pos) {
            if (++nodes > nodeCap) return false;
            if (pos === vars.length) {
                for (const c of cons) {
                    let sum = 0;
                    for (const k of c.idx) sum += assign[k] === 1 ? 1 : 0;
                    if (sum !== c.need) return true;
                }
                for (let i = 0; i < vars.length; i++) {
                    if (assign[i] === 1) canBe1[i] = true; else canBe0[i] = true;
                }
                return true;
            }
            const v = pos;
            assign[v] = 1;
            if (partialOk() && !dfs(pos + 1)) return false;
            assign[v] = 0;
            if (partialOk() && !dfs(pos + 1)) return false;
            assign[v] = -1;
            return true;
        }

        if (!dfs(0)) return null;
        if (!canBe1.some(Boolean)) return null;
        const mines = [], safe = [];
        for (let i = 0; i < vars.length; i++) {
            if (!canBe0[i]) mines.push(vars[i]);
            else if (!canBe1[i]) safe.push(vars[i]);
        }
        if (!mines.length && !safe.length) return null;
        return { mines, safe };
    }

    function safeZone(start, nb) {
        const s = new Set([start]);
        for (const j of nb[start]) s.add(j);
        return s;
    }

    /** 分帧生成器：每次 step 限制耗时，避免卡住界面 */
    function createGenerator(rows, cols, mines, start) {
        const total = rows * cols;
        const nb = buildNeighbors(rows, cols);
        const zone = safeZone(start, nb);
        let attempts = 0;
        return {
            get attempts() { return attempts; },
            step(budgetMs) {
                const deadline = Date.now() + budgetMs;
                do {
                    attempts++;
                    const board = randomBoard(nb, total, mines, zone);
                    if (solve(board, nb, total, mines, start)) {
                        return { done: true, board, nb, attempts };
                    }
                } while (Date.now() < deadline);
                return { done: false, attempts };
            }
        };
    }

    const API = { buildNeighbors, randomBoard, solve, buildConstraints, buildComponents, enumerateComponent, safeZone, createGenerator };
    if (typeof module !== "undefined" && module.exports) module.exports = API;
    root.MineCore = API;
})(typeof window !== "undefined" ? window : globalThis);
