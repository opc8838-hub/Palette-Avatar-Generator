# ui/
> L2 | 父级: ../CLAUDE.md

成员清单

main.jsx: 仅在入口创建 viewer 和 React root，HMR 时清理；组件重渲染不会重复加载模型。
App.jsx: 编排品牌、主题、图片拖放与编辑器标题栏拖动；从 viewer 逐字段订阅，不驱动渲染帧。
styles.css: 官方 shadcn 语义主题、TikTok Display 品牌字族与响应式工作台；编辑器拖动使用独立位移，不影响内部控件。
components/: 业务组件及官方生成的基础控件，详见本目录 CLAUDE.md。
lib/: viewer 订阅 hook 与类名工具，详见本目录 CLAUDE.md。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## Tone Duo adaptation
App.jsx 现为照片、人像模式、背景颜色顺序的编辑器；模式可直接点选，色系先选来源分类再选系列。palette.json 以 families / series 组织可扩展色库，新增颜色按 OKLab 色差去重；夜光能量保留 18 款。styles.css 让桌面端主要控件在单屏可见，移动端自然滚动；上传、色调和导出委托 app/avatar-engine.js。

头像背后文字默认收起，可选本地字体、示例短句并调整位置。桌面端编辑器无论模块是否展开都保持垂直居中，较长内容在面板内滚动。

编辑器标题栏可用鼠标或触控拖动整个面板；双击标题栏或按 Home 恢复默认位置，方向键可微调。拖动位移不进入 React 渲染状态，换色与设备操作不会重置面板位置。
