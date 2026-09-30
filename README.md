# Palette Avatar Generator

[打开头像工作室](https://opc8838-hub.github.io/Palette-Avatar-Generator/)

打开页面即可看到默认人物，也可以上传自己的照片。在浏览器中抠出人物，切换同色微染、中性黑白或保留原色，选择背景颜色，添加人像背后文字，并下载 1024 × 1024 PNG。颜色切换和手机开合互不影响。照片仅在当前浏览器处理，不会上传到服务器。

## 使用

1. 使用默认人物，或上传 JPG、PNG、WebP、AVIF 照片。
2. 选择人像模式、调整构图和背景色。自动换色的播放速度可以调整。
3. 按需展开“头像背后文字”，输入自己的内容或选择示例文字，再调整字体、大小和位置。
4. 点击“下载头像”保存 PNG。

清晰的原始照片会得到更好的边缘效果。

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

文字编辑的字体选择参考了 [CellMotion 图标爆发](https://github.com/opc8838-hub/font-animation/tree/main/site)；所用字体及其 OFL 许可文件一起保存在 `assets/fonts/`。
