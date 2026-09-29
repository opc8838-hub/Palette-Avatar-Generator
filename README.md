# Palette Avatar Generator

[打开头像工作室](https://opc8838-hub.github.io/Palette-Avatar-Generator/)

上传一张照片，在浏览器中抠出人物，切换同色微染、中性黑白或保留原色，选择背景颜色，并下载 1024 × 1024 PNG。颜色切换和手机开合互不影响。照片仅在当前浏览器处理，不会上传到服务器。

## 使用

1. 上传 JPG、PNG、WebP 或 AVIF 照片，也可以试用两张参考人物图。
2. 选择人像模式、调整构图和背景色。自动换色的播放速度可以调整。
3. 点击“下载头像”保存 PNG。

清晰的原始照片会得到更好的边缘效果。两张参考图来自旧截图，本身的细节有限。

## 本地开发

```bash
npm ci
npm run dev
npm test
npm run build
```

`main` 分支更新后，GitHub Actions 会构建并发布到 GitHub Pages。页面使用本机 MediaPipe 人像分割，部署后不需要本地服务，也不依赖 Vercel。GitHub Pages 不提供动态图片生成接口，因此这一版按使用者选择暂不显示 AI 抠图按钮。

## 技术结构

React 负责编辑器，Three.js 负责折叠设备预览。`app/avatar-engine.js` 在本机分离人物、合成头像并导出 PNG；`app/motion-controller.js` 独立处理手机动作。设备模型和材质基于 [iPhone Duo motion study](https://github.com/bravohenry/iphone-duo-motion-study) 改造。
