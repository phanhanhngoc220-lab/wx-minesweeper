/**
 * Node 冒烟测试（无需微信环境）
 * 校验：五档难度都能生成“无猜可解”棋盘 + 核心玩法状态机
 */
const path = require("path");
const core = require(path.join(__dirname, "..", "js", "core.js"));
const config = require(path.join(__dirname, "..", "js", "config.js"));

function generate(diff, maxAttempts) {
    let start = 0;
    const nb = core.buildNeighbors(diff.rows, diff.cols);
    const total = diff.rows * diff.cols;
    start = Math.floor(total / 2);
    const gen = core.createGenerator(diff.rows, diff.cols, diff.mines, start);
    let guard = 0;
    for (;;) {
        const res = gen.step(200);
        if (res.done) {
            return { board: res.board, nb: res.nb, start, attempts: res.attempts };
        }
        if (++guard > maxAttempts) return null;
    }
}

for (const diff of config.DIFFS) {
    const t0 = Date.now();
    const r = generate(diff, 400);
    if (!r) {
        console.error(`✗ ${diff.name}: 生成失败`);
        process.exit(1);
    }
    let mines = 0;
    for (let i = 0; i < diff.rows * diff.cols; i++) mines += r.board.mine[i];
    if (mines !== diff.mines) {
        console.error(`✗ ${diff.name}: 雷数 ${mines} != ${diff.mines}`);
        process.exit(1);
    }
    if (r.board.mine[r.start]) {
        console.error(`✗ ${diff.name}: 首击点是雷`);
        process.exit(1);
    }
    if (!core.solve(r.board, r.nb, diff.rows * diff.cols, diff.mines, r.start)) {
        console.error(`✗ ${diff.name}: 求解器无法无猜通关`);
        process.exit(1);
    }
    console.log(`✓ ${diff.name} ${diff.cols}×${diff.rows}/${diff.mines}雷 ` +
        `attempts=${r.attempts} ${Date.now() - t0}ms`);
}

// 状态机：模拟一局完整流程
const Minesweeper = require(path.join(__dirname, "..", "js", "minesweeper.js"));
const app = {
    W: 390, H: 844,
    ads: { hasRewarded: () => false, showRewarded: () => Promise.resolve(false) },
    toast: () => {},
    saveBest: () => {},
    setScene: () => {}
};
const diff = config.DIFFS[0];
const game = new Minesweeper(app, diff);
game.layout(app.W, app.H);
const r = generate(diff, 400);
game.applyBoard(r.board, r.nb);
if (game.status !== "playing") throw new Error("开局状态错误");
game.showHint();
game.toggleFlag(0);
game.toggleFlag(0);
console.log("✓ 扫雷状态机：开局 / 提示 / 插旗 正常");

console.log("全部通过");
