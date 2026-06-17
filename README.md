# TODO Plugin for Hanako

人机协作待办面板。你和 AI 助手共享一份任务列表，都可以添加、完成、编辑、删除。

<img width="1920" height="1030" alt="image" src="https://github.com/user-attachments/assets/098622aa-5ea8-4996-b798-442959888967" />


## 安装

1. 打开Hanako → 设置 → 插件
2. 开启「允许全权插件」
3. 拖入 `todo-plugin-v0.1.1.zip` 或解压到 `~/.hanako/plugins/todo/`
4. 重启Hanako

## 功能

### 面板操作（右上角插件列表）
| 操作 | 方式 |
|------|------|
| 添加待办 | 底部输入框 + 回车或点 `+` |
| 完成 / 取消完成 | 点击方框 |
| 编辑文字 | 双击待办文字 |
| 删除 | 鼠标悬停 → 点 `×` |
| 拖拽排序 | 鼠标悬停 → 拖 `≡` 手柄（仅限未完成项） |
| 折叠 / 展开 | 点面板标题栏的 `−` |

### AI 工具
| 工具 | 用途 |
|------|------|
| `todo-add` | 添加待办 |
| `todo-list` | 查看全部待办 |
| `todo-toggle` | 完成 / 取消完成 |
| `todo-delete` | 删除待办 |

面板每 5 秒自动刷新，AI 操作后无需手动重开。

## 项目结构

```
todo/
├── manifest.json       # 插件元信息 & widget 注册
├── index.js            # 生命周期入口
├── README.md
├── lib/
│   └── store.js        # 数据层（JSON 文件读写）
├── routes/
│   ├── widget.js       # Widget HTML 页面
│   └── api.js          # REST API（CRUD）
└── tools/
    ├── todo-add.js     # AI 工具：添加
    ├── todo-list.js    # AI 工具：查看
    ├── todo-toggle.js  # AI 工具：完成/取消
    └── todo-delete.js  # AI 工具：删除
```

## 已知问题

| 问题                     | 原因                                                                                             | 状态                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **主题切换后 widget 配色不跟随** | Widget 是 iframe，CSS 自定义属性不跨文档级联。Hanako 未在主题变更时向 widget 发送通知。                                   | 等待 Hanako 支持 `postMessage('theme-changed')`        |
| **拖动侧边栏缩小时偶有延迟 / 卡住**  | iframe 独立渲染线程与父窗口不同步，宽度变化时需重排。                                                                 | iframe 方案固有开销，重大改需将 widget 改为原生 React 组件           |
| **Widget 钉住状态重启后丢失**   | Hanako 桌面 bug：`savePluginPrefs()` 将钉住状态正确保存到 `/api/preferences`，但 `refreshPluginUI()` 启动时没有读回。 | [已提 issue](https://github.com/liliMozi/openhanako/issues/731) |

## 开发

依赖：Node.js ≥ 18，Hanako 桌面需启用全权插件。

- 数据存储：`{hanakoHome}/plugin-data/todo/todos.json`
- 认证：Widget 从父窗口 iframe URL 提取 `token` 参数，注入到所有 `fetch()` 的 `Authorization: Bearer` 头
- Widget 握手：必须在加载后 5 秒内发送 `postMessage({type: "ready"})`，否则显示「加载失败」

## License

MIT
