# tests/
> L2 | 父级: ../CLAUDE.md

成员清单

mockup-controller.test.mjs: Node test 驱动的六项无 GPU 回归；只验证图片状态/竞态和姿态契约，不冒充浏览器渲染证据。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

avatar-motion.test.mjs: 验证随机配色来源与重现、所有预设每个格子的连续循环、蒙版空间缩放、无外部依赖的离线导出执行及动效英文文案覆盖。

avatar-tone.test.mjs: 验证中性灰阶、Alpha 保留、棕色染色不改变亮度、无彩色与明暗极值、分组色库、新参考色系、Mindful 300 精简色卡及原参考底色。
i18n.test.mjs: 确认色系、色卡与示例文字的英文覆盖，防止切换后残留中文。

saved-looks.test.mjs: 快照防变、有效配色去重、5 套上限、选择过滤、收藏 ZIP CRC / 文件清单 / 尺寸调用 / 按已存配色导出；不冒充浏览器像素验收。
