const ads = require("./js/ads");
const Lobby = require("./js/lobby");
const Minesweeper = require("./js/minesweeper");
const UI = require("./js/ui");

const canvas = wx.createCanvas();
const ctx = canvas.getContext("2d");
let sys = wx.getSystemInfoSync();
let W = sys.windowWidth;
let H = sys.windowHeight;
const dpr = Math.min(sys.pixelRatio || 2, 3);

function fitCanvas() {
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.scale(dpr, dpr);
}

fitCanvas();

const app = {
    W,
    H,
    ads,
    scene: null,
    lastDiff: null,
    toastText: "",
    toastUntil: 0
};

/** 横竖屏切换 / 窗口尺寸变化时重排 */
function handleResize() {
    try {
        sys = wx.getSystemInfoSync();
        W = sys.windowWidth;
        H = sys.windowHeight;
        fitCanvas();
        app.W = W;
        app.H = H;
        if (app.scene) {
            if (app.scene.layout) app.scene.layout(W, H);
            else if (app.scene.enter) app.scene.enter();
        }
    } catch (e) {
        // 老版本基础库没有 resize 事件时忽略
    }
}

if (wx.onWindowResize) {
    wx.onWindowResize(handleResize);
}
if (wx.onDeviceOrientationChange) {
    wx.onDeviceOrientationChange(function () { setTimeout(handleResize, 60); });
}

app.toast = function (msg) {
    app.toastText = msg;
    app.toastUntil = Date.now() + 1600;
};

/** 运行时切换横竖屏（基础库支持 wx.setDeviceOrientation 时） */
app.toggleOrientation = function () {
    const target = W > H ? "portrait" : "landscape";
    if (!wx.setDeviceOrientation) {
        app.toast("当前基础库不支持转屏");
        return;
    }
    try {
        wx.setDeviceOrientation({
            value: target,
            fail: function () { app.toast("转屏失败，请检查基础库版本"); }
        });
    } catch (e) {
        app.toast("转屏失败");
        return;
    }
    setTimeout(handleResize, 300);
    setTimeout(handleResize, 800);
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
    if (scene === "lobby") scene = new Lobby(app);
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
