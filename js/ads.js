/**
 * 广告封装：
 * - 未配置 adUnitId 或环境不支持时，自动降级为“开发模式”，不阻塞游戏流程
 * - 激励视频失败/中途关闭时返回 false，由业务决定是否给奖励
 */
const config = require("./config");

let rewardedAd = null;
let bannerAd = null;
let rewardedReady = false;

function init() {
    if (typeof wx === "undefined" || !wx.createRewardedVideoAd) return;
    if (!config.AD_UNITS.rewarded) return;
    try {
        rewardedAd = wx.createRewardedVideoAd({ adUnitId: config.AD_UNITS.rewarded });
        rewardedAd.onLoad(() => { rewardedReady = true; });
        rewardedAd.onError(() => { rewardedReady = false; });
    } catch (e) {
        rewardedAd = null;
    }
}

function hasRewarded() {
    return !!rewardedAd;
}

function showRewarded() {
    return new Promise((resolve) => {
        if (!rewardedAd) { resolve(false); return; }
        let settled = false;
        const onClose = (res) => {
            if (settled) return;
            settled = true;
            resolve(!!(res && res.isEnded));
        };
        rewardedAd.onClose(onClose);
        rewardedAd.show().catch(() => {
            rewardedAd.load().then(() => rewardedAd.show()).catch(() => {
                if (!settled) { settled = true; resolve(false); }
            });
        });
    });
}

function showBanner(x, y, width) {
    if (typeof wx === "undefined" || !wx.createBannerAd) return null;
    if (!config.AD_UNITS.banner) return null;
    try {
        bannerAd = wx.createBannerAd({
            adUnitId: config.AD_UNITS.banner,
            style: { left: x, top: y, width }
        });
        bannerAd.onError(() => {});
        bannerAd.show();
        return bannerAd;
    } catch (e) {
        return null;
    }
}

function hideBanner() {
    if (bannerAd) {
        try { bannerAd.hide(); } catch (e) { /* ignore */ }
        bannerAd = null;
    }
}

module.exports = { init, hasRewarded, showRewarded, showBanner, hideBanner };
