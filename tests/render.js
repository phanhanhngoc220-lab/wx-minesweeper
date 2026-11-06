/**
 * 渲染冒烟测试：用 Proxy 伪造 Canvas 2D 上下文，跑一遍大厅和棋盘绘制
 */
const path = require("path");
const Lobby = require(path.join(__dirname, "..", "js", "lobby.js"));
const Minesweeper = require(path.join(__dirname, "..", "js", "minesweeper.js"));
const config = require(path.join(__dirname, "..", "js", "config.js"));

function fakeCtx() {
    const gradient = { addColorStop() {} };
    const target = {
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
        measureText: (s) => ({ width: String(s).length * 7 })
    };
    return new Proxy(target, {
        get(t, k) {
            if (k in t) return t[k];
            return () => {};
        },
        set() { return true; }
    });
}

const W = 390, H = 844;
const ctx = fakeCtx();

let game = null;
const app = {
    W, H,
    lastDiff: "beginner",
    ads: { hasRewarded: () => false, showRewarded: () => Promise.resolve(false) },
    toast: (m) => { lastToast = m; },
    saveBest: () => {},
    getBest: () => 0,
    setScene: (s) => { scene = s; if (s.enter) s.enter(); },
    startGame: (d) => {
        game = new Minesweeper(app, d);
        game.enter();
        scene = game;
    }
};
let scene = null;
let lastToast = "";

const lobby = new Lobby(app);
app.setScene(lobby);
lobby.draw(ctx, W, H);

// 选择“高级”，再点开始
const expertChip = lobby.chips.find(c => c.diff.key === "expert");
lobby.onTouchEnd(expertChip.rect.x + 4, expertChip.rect.y + 4);
if (app.lastDiff !== "expert") throw new Error("难度选择失败");
lobby.onTouchEnd(lobby.startRect.x + 4, lobby.startRect.y + 4);
if (!game || game.diff.key !== "expert") throw new Error("开始游戏失败");
game.draw(ctx, W, H);
console.log("✓ 大厅绘制 / 选择难度 / 开始游戏");

// 点击棋盘中心开局
const b = game.boardRect;
const cx = b.x + b.w / 2;
const cy = b.y + b.h / 2;
game.onTouchStart(cx, cy);
game.onTouchEnd(cx, cy);
if (game.status !== "generating") throw new Error("未进入生成状态，status=" + game.status);

setTimeout(() => {
    if (game.status !== "playing") throw new Error("生成未完成，status=" + game.status);
    game.draw(ctx, W, H);
    console.log("✓ 点击开局：生成无猜棋盘并绘制");

    game.showHint();
    game.draw(ctx, W, H);
    console.log("✓ 提示绘制，toast=" + lastToast);

    // 双指放大
    const a = { clientX: 120, clientY: 400 };
    const c2 = { clientX: 270, clientY: 400 };
    game.onTouchStart({ touches: [a, c2] });
    game.onTouchMove({ touches: [{ clientX: 80, clientY: 400 }, { clientX: 310, clientY: 400 }] });
    if (game.zoom <= 1.05) throw new Error("双指缩放失败，zoom=" + game.zoom);
    game.onTouchEnd({ touches: [{ clientX: 80, clientY: 400 }], changedTouches: [{ clientX: 310, clientY: 400 }] });
    game.draw(ctx, W, H);
    console.log("✓ 双指缩放，zoom=" + game.zoom.toFixed(2));

    // 放大后单指拖动
    const panBefore = game.panX;
    game.onTouchStart(200, 400);
    game.onTouchMove({ touches: [{ clientX: 240, clientY: 400 }] });
    game.onTouchEnd(240, 400);
    if (game.panX === panBefore) throw new Error("放大后拖动无效");
    game.draw(ctx, W, H);
    console.log("✓ 放大后单指拖动");

    game.resetZoom();
    if (game.zoom !== 1) throw new Error("复位失败");
    game.draw(ctx, W, H);
    console.log("✓ 双击复位（resetZoom）");

    // 下滑插旗
    let target = -1;
    for (let i = 0; i < game.total; i++) {
        if (!game.revealed[i] && !game.flagged[i]) { target = i; break; }
    }
    const tr = Math.floor(target / game.cols), tc = target % game.cols;
    const tx = game.boardRect.x + tc * (game.cell + game.gap) + game.cell / 2;
    const ty = game.boardRect.y + tr * (game.cell + game.gap) + game.cell / 2;
    const flagsBefore = game.flags;
    game.onTouchStart(tx, ty);
    game.onTouchMove({ touches: [{ clientX: tx, clientY: ty + 30 }] });
    if (game.flags !== flagsBefore + 1) throw new Error("下滑插旗失败 flags=" + game.flags);
    game.onTouchEnd(tx, ty + 30);
    game.draw(ctx, W, H);
    console.log("✓ 下滑插旗");

    // 快速下滑（一次位移 80px），验证不会因为跨度大而漏判
    let target2 = -1;
    for (let i = 0; i < game.total; i++) {
        if (!game.revealed[i] && !game.flagged[i]) { target2 = i; break; }
    }
    const tr2 = Math.floor(target2 / game.cols), tc2 = target2 % game.cols;
    const tx2 = game.boardRect.x + tc2 * (game.cell + game.gap) + game.cell / 2;
    const ty2 = game.boardRect.y + tr2 * (game.cell + game.gap) + game.cell / 2;
    const flags2 = game.flags;
    game.onTouchStart(tx2, ty2);
    game.onTouchMove({ touches: [{ clientX: tx2 + 6, clientY: ty2 + 80 }] });
    if (game.flags !== flags2 + 1) throw new Error("快速下滑插旗失败 flags=" + game.flags);
    game.onTouchEnd(tx2 + 6, ty2 + 80);
    game.draw(ctx, W, H);
    console.log("✓ 快速下滑插旗");

    // 模拟踩雷：直接调用 lose 绘制结算
    game.lose(0);
    game.draw(ctx, W, H);
    console.log("✓ 结算浮层绘制");

    // 胜利浮层
    game.status = "won";
    game.elapsed = 42;
    game.draw(ctx, W, H);
    console.log("✓ 胜利浮层绘制");

    // 再来一局：应回到全新空白棋盘
    game.buttons.again = null;
    game.restart();
    if (game.status !== "ready" || game.board !== null) {
        throw new Error("再来一局没有重置，status=" + game.status);
    }
    if (game.revealedCount !== 0 || game.flags !== 0) throw new Error("再来一局残留数据");
    game.draw(ctx, W, H);
    console.log("✓ 再来一局重置为空白棋盘");

    // 返回大厅
    game.onTouchEnd(game.backRect.x + 2, game.backRect.y + 2);
    console.log("✓ 返回大厅");
    console.log("渲染冒烟全部通过");
}, 1800);
