/* 浏览器预览：把大厅/棋盘画到 canvas 上，便于截图检查布局 */
const Lobby = req("./js/lobby.js");
const Minesweeper = req("./js/minesweeper.js");
const core = req("./js/core.js");
const config = req("./js/config.js");

const W = 390, H = 844;
const canvas = document.getElementById("c");
const dpr = 2;
canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = W + "px";
canvas.style.height = H + "px";
const ctx = canvas.getContext("2d");
ctx.scale(dpr, dpr);

const app = {
    W, H,
    lastDiff: "expert",
    ads: { hasRewarded: () => false, showRewarded: () => Promise.resolve(false) },
    toast: () => {},
    saveBest: () => {},
    getBest: () => 97,
    setScene: (s) => { scene = s; },
    startGame: (d) => {
        game = new Minesweeper(app, d);
        game.layout(W, H);
        scene = game;
    }
};
let scene = null;
let game = null;

if (location.hash === "#game") {
    app.startGame(config.DIFFS.find(d => d.key === "expert"));
    const start = Math.floor((game.rows * game.cols) / 2);
    const gen = core.createGenerator(game.rows, game.cols, game.mineCount, start);
    let res;
    do { res = gen.step(500); } while (!res.done);
    game.applyBoard(res.board, res.nb);
    game.showHint();
    game.draw(ctx, W, H);
} else {
    scene = new Lobby(app);
    scene.layout(W, H);
    scene.draw(ctx, W, H);
}
