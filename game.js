const ads = require("./js/ads");
const Lobby = require("./js/lobby");
const Minesweeper = require("./js/minesweeper");
const UI = require("./js/ui");

const canvas = wx.createCanvas();
const ctx = canvas.getContext("2d");
const sys = wx.getSystemInfoSync();
const W = sys.windowWidth;
const H = sys.windowHeight;
const dpr = Math.min(sys.pixelRatio || 2, 3);

canvas.width = Math.floor(W * dpr);
canvas.height = Math.floor(H * dpr);
ctx.scale(dpr, dpr);

const app = {
    W,
    H,
    ads,
    scene: null,
    lastDiff: null,
    toastText: "",
    toastUntil: 0
};

app.toast = function (msg) {
    app.toastText = msg;
    app.toastUntil = Date.now() + 1600;
};

app.getBest = function (key) {
    const all = wx.getStorageSync("best") || {};
    return all[key] || 0;
};

app.saveBest = function (key, sec) {
    const all = wx.getStorageSync("best") || {};
    if (!all[key] || sec < all[key]) {
        all[key] = sec;
        wx.setStorageSync("best", all);
    }
};

app.startGame = function (diff) {
    app.lastDiff = diff.key;
    app.setScene(new Minesweeper(app, diff));
};

app.setScene = function (scene) {
    if (app.scene && app.scene.exit) app.scene.exit();
    app.scene = scene;
    if (scene.enter) scene.enter();
};

function drawToast() {
    if (!app.toastText || Date.now() > app.toastUntil) {
        app.toastText = "";
        return;
    }
    const pad = 18;
    const w = Math.min(W - 48, 300);
    const textW = ctx.measureText(app.toastText).width;
    const x = (W - w) / 2;
    const y = H - 200;
    UI.fillRound(ctx, x, y, w, 44, 12, "rgba(10,16,32,0.92)");
    UI.strokeRound(ctx, x, y, w, 44, 12, "rgba(120,150,210,0.35)", 1);
    UI.text(ctx, app.toastText, W / 2, y + 22, 13, "#e8eefc", "center");
    void textW;
}

function frame() {
    if (app.scene) app.scene.draw(ctx, W, H);
    drawToast();
    requestAnimationFrame(frame);
}

ads.init();
app.setScene(new Lobby(app));

wx.onTouchStart(function (e) {
    if (app.scene && app.scene.onTouchStart) app.scene.onTouchStart(e);
});

wx.onTouchMove(function (e) {
    if (app.scene && app.scene.onTouchMove) app.scene.onTouchMove(e);
});

wx.onTouchEnd(function (e) {
    if (app.scene && app.scene.onTouchEnd) app.scene.onTouchEnd(e);
});

requestAnimationFrame(frame);
