# app/
> L2 | 父级: ../CLAUDE.md

成员清单

illustration-engine.js: 加载四张已确认手绘 PNG，移除外部背景，按两个人工区域样例合成服饰和妆色；不处理任意上传照片的手绘生成。

config.js: 不可变产品状态与教学阶段；六姿态按 Closed、Foldable、Landscape、Portrait、Seated、Standing 排列，首项是默认状态。
material-fidelity.js: 从原始 LSD 还原 AO、Logo 透明度、镜头光学层及 Finish/Optics EXR 映射；保持屏幕和导出材质一致。
mockup-controller.js: 独占本地图片解码、每屏裁切和替换竞态；回调只发布元数据，像素送入 wallpaper renderer，无 UI DOM。
motion-controller.js: 独占 Slider 采样、可中断姿态过渡与 OrbitControls；变形后整机居中，手动操作打断姿态过渡，无自动环绕。
png-exporter.js: 同一 scene/camera 的离屏 MSAA + SSAA 渲染、降采样、Alpha 紧边裁切与浏览器下载。
render-quality.js: 纯函数计算 DPR、超采样和总像素预算；与 UI 框架无关。
render-runtime.js: 创建透明 WebGL 场景、工作台相机、双层 PMREM 与灯光；设备透出页面背景，开关灯不修改材质或导出像素。
screen-materials.js: 补齐外屏摄像头开孔、隐藏镜头部件，并将动态内外屏纹理注入已知模型节点；隔离 glTF 命名与屏幕材质策略。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

avatar-motion.js: 确定性配色、格子蒙版、十二种连续循环动效及形状绘制；预览与离线 HTML 使用同一采样器，导出渲染依赖封装为完整闭包，可兼容生产压缩。

## Tone Duo adaptation
avatar-tone.js: 纯函数灰阶与保亮度染色，可运行 Node 测试。
avatar-engine.js: 本地照片分割、默认人物加载、背后文字与头像/设备画布合成、PNG 下载；文字支持 24–640px，按实际字号绘制，超出画布自然裁切；设备的染色人像使用与头像导出相同的像素算法。
mockup-controller.js: 增加 setCanvas 直接更新内外屏；main.js 暴露 setScreenCanvas，折叠稳定后缓存静态画面。

avatar-package.js: 浏览器生成无压缩 ZIP，九张 PNG + 配色 JSON + 说明；CRC32、中央目录和文件下载。
draft-store.js: IndexedDB 显式保存一份草稿，含本机处理后的照片与设置；不做云上传，不作为自动存档。
avatar-engine.js: 单图导出可选 256/512/1024 像素。

saved-looks.js: 配色快照、去重、每人像 5 套上限和勾选过滤。
draft-store.js: IndexedDB 升级至 2，保留旧草稿；收藏按人像 key 隔离，收藏与最新草稿在同一事务中写入。
avatar-package.js: 收藏 ZIP 按每套三版 × 三尺寸导出，以 look-NN 区分文件并附配色清单；不打包未勾选色卡。
