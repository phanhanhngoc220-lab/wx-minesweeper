module.exports = {
    APP_NAME: "小游戏盒子",
    SUBTITLE: "无猜扫雷 · 更多游戏开发中",

    // 在微信公众平台 -> 流量主 -> 广告位管理 创建后填入
    // 留空时自动进入开发模式（不展示广告、不阻塞流程）
    AD_UNITS: {
        rewarded: "",
        banner: ""
    },

    DIFFS: [
        { key: "entry", name: "入门", rows: 9, cols: 9, mines: 8 },
        { key: "beginner", name: "初级", rows: 9, cols: 9, mines: 10 },
        { key: "intermediate", name: "中级", rows: 16, cols: 16, mines: 40 },
        { key: "expert", name: "高级", rows: 16, cols: 30, mines: 99 },
        { key: "master", name: "专家", rows: 20, cols: 30, mines: 130 }
    ]
};
