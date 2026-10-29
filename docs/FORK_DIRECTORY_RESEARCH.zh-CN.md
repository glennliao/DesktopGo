# DesktopGo fork、目录关联与上游同步调研

调研及方案更新日期：2026-10-29。状态：用户已确认列表、列表内文件夹均可关联目录，并支持在软件内逐层展开子目录；关联功能代码已在本地 `fork/main` 分支实现，自动检查已通过，Windows 界面仅完成菜单与目录选择框入口验证，后续交互待人工验收；未创建 GitHub fork，未推送或发布；本地提交以 Git 记录为准。

## 结论

1. 建议从上游默认分支 `desktop` 开始。当前提交为 `b95939ae70ee6332a5f3181b4bd7c008fbfa54e4`。
2. `dev/sidebar` 已完整包含在 `desktop` 中，无需合并旧分支。
3. 用户需要的是目录内容持续映射到界面，省去逐项导入和整理；现有导入及搜索目录配置均不能直接满足。
4. 两个关联位置均实现：一级关联列表，以及列表内的关联文件夹。列表的磁盘子目录在内容区逐层浏览，关联文件夹的磁盘子目录在同一弹层浏览，提供返回和面包屑。
5. 复用现有列表、文件夹弹层外壳、图标、滚动区、目录选择和启动能力；磁盘目录按层读取，动态内容不进入手工拖拽布局或托管图标库。
6. fork 的独立发行身份和更新通道应与通用目录功能分开维护。

## 已核实的上游事实

### sidebar 分支

| 引用 | 提交 |
| --- | --- |
| 默认分支 `desktop` | `b95939ae70ee6332a5f3181b4bd7c008fbfa54e4` |
| `dev/sidebar` | `3c7b6e8dde262a87a2d4b6fdb43f81da67e9d751` |

执行结果：

```text
git merge-base origin/desktop origin/dev/sidebar
3c7b6e8dde262a87a2d4b6fdb43f81da67e9d751

git merge-base --is-ancestor origin/dev/sidebar origin/desktop
exit 0

git rev-list --left-right --count origin/desktop...origin/dev/sidebar
250 0
```

这是祖先包含关系，意味着 sidebar 没有待合并的独有提交。当前源码仍有滚动分组侧栏，并通过右键菜单“网格模式”切换布局。上述结论不代表桌面交互已经实机验收。

来源：[sidebar 提交](https://github.com/Aixbox/DesktopGo/commit/3c7b6e8dde262a87a2d4b6fdb43f81da67e9d751)、[当前 desktop 提交](https://github.com/Aixbox/DesktopGo/commit/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4)、[布局切换入口](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/launchpad/LaunchpadContextMenuContent.tsx#L160-L165)。

### 列表和两种文件夹

| 对象 | 当前数据和行为 | 与关联目录的差距 |
| --- | --- | --- |
| 侧栏列表／滚动分组 | `ScrollGroupMeta` 保存 id、名称、图标、itemIds | 没有磁盘目录绑定 |
| 界面内分组文件夹 | `FolderItem` 保存 id、名称、尺寸、`IconItem[]` 成员，使用文件夹弹层展开 | 没有磁盘路径，成员靠布局维护 |
| 导入的真实目录入口 | `DesktopIcon.item_type = 'folder'`，经过普通图标启动链路打开 | 不会在现有文件夹弹层自动枚举目录内容 |

真实目录入口也可以位于界面内分组文件夹中，但它仍是一个普通入口，不等于多层分组文件夹。当前 `FolderItem.children` 为 `IconItem[]`，不能直接嵌套 `FolderItem`。

文件夹恢复时还有特定规则：两个及以上成员才保留文件夹；一个成员收拢为图标；零个成员不保留。关联文件夹需要保留空目录及单成员目录的身份。

来源：[界面模型](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/model.ts#L6-L30)、[分组模型](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/model.ts#L107-L112)、[文件夹恢复规则](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/services/layoutStore.ts#L402-L425)、[普通图标点击](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/Icon.tsx#L76-L89)、[系统启动实现](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/src/icons/platform_windows.rs#L495-L518)。

### 导入与搜索目录不能替代目录映射

当前读取的是统一图标库快照。拖入时会复制 `.lnk` 或创建托管快捷方式，不会持续把原目录的成员映射成界面内容。README 仍保留 `customapp/customAppDir` 的旧描述，但当前设置项和使用指南已转为主动导入的图标库，不能据此判断已经有可用的关联目录开关。

搜索侧“最佳匹配目录”已有目录选择、扫描、层数、过滤等能力，但消费者是搜索结果。枚举函数对部分读取失败直接跳过，不能原样充当需要区分“目录为空”和“读取失败”的目录映射接口。可以复用适合的路径处理、快捷方式解析和图标提取能力，避免强行复用搜索语义。

来源：[统一图标库读取](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/src/icons/catalog_windows/storage.rs#L228-L255)、[导入实现](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/src/icons/catalog_windows/operations/import.rs#L29-L105)、[当前使用指南](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/docs/USER_GUIDE.zh-CN.md#L176-L191)、[搜索目录枚举](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/src/launcher_catalog.rs#L275-L322)、[目录设置组件](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/search/BestMatchFolderSettings.tsx)。

## 已确认需求与默认行为

### 两个关联位置共用一套目录能力

| 位置 | 关联后显示 | 子目录点击 |
| --- | --- | --- |
| 一级关联列表（分页／侧栏） | 在当前列表直接显示关联目录的直接子项 | 从封面展开文件夹弹窗，关闭后保留原分页与滚动位置 |
| 列表内的文件夹 | 点击文件夹后，在弹层显示关联目录的直接子项 | 在同一弹层进入下一层，显示返回和面包屑 |

文件留在原磁盘位置，不复制到 `customapp` 或托管图标库，不创建中转快捷方式。每个列表或文件夹关联一个根目录；同一路径允许关联到不同位置，它们各自保留自己的容器名称和位置。

```text
侧栏：工具 [关联 D:\工具]
  ├─ VS Code.lnk                -> 原快捷方式启动
  ├─ 截图工具.exe              -> 原路径启动
  └─ 开发资料\                 -> 在软件内展开
       └─ Rust\                -> 继续在同一内容区展开
            └─ 速查表.pdf      -> 系统默认应用打开

侧栏：工作 [普通手工列表]
  ├─ 常用软件                  -> 原有手工入口
  ├─ 项目资料 [关联 E:\项目资料]
  │    └─ 展开、进入子目录、返回均在软件内完成
  └─ 手工分组文件夹            -> 保持现有行为
```

### 关联入口与已有内容

- 复用侧栏列表右键菜单，增加“关联目录”；关联后同一位置提供“更换目录”“刷新”“取消关联”。
- 复用文件夹右键菜单，提供相同操作；列表添加入口中增加“关联文件夹”，选择目录后直接创建关联入口，避免先拖入两个图标才能创建文件夹。
- 已经导入的普通目录图标保持原来的点击行为；通过“关联文件夹”创建新关联入口，不额外实现会牵涉图标库记录迁移的自动转换。
- 文件夹关联在分页、滚动布局中均可使用。一级关联列表复用 `scrollGroups` 中的同一份元数据与手工成员：分页模式通过顶部列表栏切换，并按可用空间分页；侧栏模式通过左侧列表切换，并连续滚动。创建关联列表不改变显示模式。原有手工分页布局和手工侧栏布局分别保留，不自动迁移或覆盖。分页模式可打开关联列表的手工成员，编辑和拖拽继续复用侧栏布局。
- 关联现有容器时保留原有手工项：手工项维持原顺序，目录项接在其后；新建的关联容器自然只显示目录内容。两者在数据及操作上区分，关联不会把手工项写进磁盘目录。
- 目录项默认“目录优先、名称自然排序”，跟随界面语言进行显示排序。不为第一版增加每目录筛选器、同步模式或排序配置。
- 容器名称是 DesktopGo 内的显示名称；改容器名不改磁盘目录名。更换关联目录保留容器 ID、名称、尺寸和手工成员。

### 多级展开与返回

一级列表的子目录从对应封面展开既有文件夹弹层；关联文件夹也使用同一个文件夹弹层外壳。进入下一层只替换当前内容，不叠加弹窗，也不创建持久化分组。根目录只显示名称和刷新；进入子目录后才显示“返回上一级”和面包屑。标题区显示“关联根名称 / 子目录 / 当前目录”，完整路径通过 tooltip 查看。侧栏只使用外层一个滚动区。

- 文件夹入口打开时从关联根开始；一级列表初始显示关联根，子目录通过文件夹弹窗展开，关闭后回到原列表。
- 返回按钮／`Alt+Left` 回到上一层，面包屑可跳回任一祖先；弹窗的返回和面包屑限制在本次打开的子目录范围，关闭弹窗回到原列表。
- `Escape` 沿用现有关闭弹层的行为；文本编辑中不抢占输入。返回时恢复上一层滚动位置和焦点；关闭时恢复来源入口焦点。
- 进入磁盘子目录时不允许编辑该层标题，避免把容器显示名编辑误认为磁盘改名。
- 普通文件、exe、lnk、url 沿用原路径启动；快捷方式不因目标恰好是目录就自动转换为目录浏览，保留其启动参数及原本语义。

## 实施设计

### 决策一：关联随布局保存，目录内容仅作运行时数据

关联关系随容器进入布局 payload，不另存到全局 Tauri Store。这样恢复旧布局时，容器和关联路径一起恢复，避免路径丢失或被后来的全局设置替换。

不建立全局目录注册表。给现有列表和手工文件夹各增加同一个可选字段，示意如下：

```typescript
type DirectoryLink = {
  version: 1
  rootPath: string
  folderSizes?: Record<string, FolderSize> // 子目录相对路径到所选尺寸
}

// 在现有类型上增量添加，原有字段保持原义
// ScrollGroupMeta.directory?: DirectoryLink
// FolderItem.directory?: DirectoryLink
// PersistedItem 中的 folder 分支也保存 directory
```

`ScrollGroupMeta.itemIds` 和 `FolderItem.children` 仍然只保存手工项。目录扫描结果不塞入这两个字段、不加入 `useIconStore.icons`、不写入图标库快照。保存的是关联路径和原有容器，目录内容在打开时读取。

动态条目只在各自目录视图中使用“当前根路径 + 相对路径”作为稳定标识，不注册全局图标 ID。同一目录刷新后未变路径的条目身份稳定；不同关联位置各有独立视图，不会因路径相同而争抢布局成员。同一 exe 的多个快捷方式按入口路径区分，不能只按目标 exe 去重。

保留上游布局基础版本的演进机制，不为该功能自行抢占全局下一个版本号；`directory.version` 只管理关联字段自己的格式。当前 v1-v9 旧数据没有该字段时按原行为读取，新字段要显式通过序列化、解析和归一化流程。未知关联字段版本保留原始数据并显示关联不可用，不能降级成空手工文件夹后覆盖保存。

这不意味着未修改的上游客户端可以无损读写 fork 布局：旧代码会丢弃未知字段。fork 独立应用数据目录仍是发行方案的一部分；后续 merge 上游代码时必须保留关联字段的完整读写链路。

已关联文件夹即使零成员或一个成员也保留身份。除首次 hydration 外，还必须处理 `replaceFolderChildren`、提取成员后的 finalize、解散和 AI 重建等会自动收拢文件夹的路径，不能只修加载入口。

布局库保存／预览／取消／恢复都带上关联路径；历史布局恢复后展示该目录的**当前内容**，不回滚磁盘文件。几何变化时的布局重建保留关联字段。缩略图以现有容器和关联标记为准，可以显示本次已有的预览图，但不为了生成历史缩略图重新扫描磁盘或保存动态成员。

来源：[布局序列化与解析](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/services/layoutStore.ts)、[成员变更收拢规则](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/domain/folderPolicy.ts#L99-L156)、[分组归一化](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/scroll/scrollGroupLayout.ts#L70-L130)、[布局恢复时重建 payload](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/layout-library/layoutLibrary.ts#L140-L161)。

### 决策二：磁盘子目录用导航状态表达，不扩展递归布局树

保留 `GridItem = IconItem | FolderItem`，不把 `FolderItem.children` 改成递归 `GridItem[]`。多级磁盘目录的层级属于运行时导航，不属于手工摆放树。

共用一个目录内容视图和读取 hook。关联列表将它嵌入当前网格的目录区域；关联文件夹将它放入现有文件夹弹层，各自的磁盘子目录继续在当前内容区导航。目录视图只需知道当前关联、相对路径、加载结果以及打开动作，不依赖整个启动台 store 或全部应用设置。

导航状态只保留来源容器、当前相对路径和本次浏览的返回记录。进入子目录只读该层；返回记录保存必要的焦点／滚动位置，不持久化整棵目录树。关闭后结束本次导航；下次从该入口重新开始。

原弹层的遮罩、主题、圆角、尺寸计算、打开／关闭动画、焦点圈定和关闭恢复可以复用；对外补充目录导航栏和内容区域。手工文件夹拖拽网格继续使用原有实现，不把目录浏览硬塞进它的成员拖拽控制器。必要的小范围提取只围绕这个真实的第二个调用方进行，不创建另一套同样的弹层样式。

来源：[现有文件夹弹层](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/views/FolderModalView.tsx)、[现有文件夹控制器](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/scroll/useScrollableFolderController.ts#L75-L103)、[共享网格与弹层尺寸计算](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/domain/gridGeometry.ts#L6-L24)。

### 决策三：只新增按层读取命令，复用图标与启动能力

Rust 增加一个小型目录读取模块，以及一个命令 `read_directory`。输入为 `rootPath` 和 `relativePath`；空相对路径代表关联根。输出当前层条目，每项包含名称、实际路径、相对路径、是否目录及目录链接状态；不在该命令里为所有条目解析图标或创建快捷方式。

命令通过现有 `spawn_blocking` 模式执行目录枚举。失败提供可区分的代码：目录不存在、不是目录、无权限、越出关联根、其他读取错误；成功空目录返回空数组。枚举中途出错也必须回报，不能使用 `flatten()` 静默丢项后当完整结果覆盖。

路径处理复用适合的现有能力，但根目录范围判断使用规范化后的路径组件，而不是字符串前缀。拒绝作为相对路径传入的绝对路径及 `..` 越界。普通子目录可逐层进入；符号链接／junction 不自动递归，点击时解析并检查：根内目标可进入，跳回导航链祖先的目录环不继续进入，根外链接提供“在资源管理器中打开”。这些判断都在后端完成，前端导航不能代替路径校验。

文件名按实际名称显示，保留扩展名及带点目录名，避免直接套用现有扫描 helper 中统一的 `file_stem()`。系统隐含项沿用项目已有过滤规则，集中在目录模块处理；不新增隐藏文件设置面板。

图标复用 `get_search_result_icons` 及其现有缓存；对可见行／网格批量取图标，不为每个目录项创建托管快照或新的磁盘图标缓存。现有按批加载上限为 128，目录视图按该约束发送请求。`useVisibleSearchIcons` 固定为搜索结果的 48px，因此不能假定可直接满足所有图标尺寸；若当前尺寸需要更高分辨率，给现有图标加载能力增加可选尺寸参数，搜索保持原默认值，不另建同功能缓存。

普通图标的 `onActivate` 已提供点击覆盖点，可据此让目录在软件内导航、文件继续走现有 `launch_app`。现有 `Icon` 同时绑定图标库编辑／删除菜单，目录项复用其视觉时要提供明确的目录来源菜单模式／组合入口，不能只覆盖左键而漏掉右键删除、Shift+右键和批量操作。

来源：[异步命令及批量图标命令](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/src/commands/search.rs)、[图标缓存与批次上限](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/src/icons/search_cache.rs#L23-L27)、[可见图标加载 hook](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/search/useVisibleSearchIcons.ts)、[图标点击覆盖点](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/Icon.tsx#L76-L89)、[图标菜单耦合](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icons/IconContextMenu.tsx)。

### 决策四：目录内容与手工操作明确分开

| 操作 | 关联容器／目录项的行为 |
| --- | --- |
| 拖动关联文件夹入口、调整大小、移到 Dock | 按现有虚拟文件夹操作，关联跟随原容器 ID；不改磁盘 |
| 向关联列表／关联文件夹的手工区域添加入口 | 继续添加手工项，不向磁盘目录写文件 |
| 目录项拖拽排序、拖入另一个文件夹、从外部拖文件到目录内容区 | 本版不接入文件搬移或持久化排序，不能落入现有图标重排／合并逻辑 |
| 目录项左键、右键“打开” | 文件按原路径启动，实际子目录在软件内展开 |
| 目录项右键 | 提供打开、在资源管理器中打开／定位、刷新等适用动作；不挂图标库隐藏、编辑或删除菜单，也不透传可改磁盘的原生菜单 |
| 取消关联 | 只移除关联与动态显示；手工项保留。文件夹恢复普通手工文件夹规则，空／单成员时按原规则移除／收拢；侧栏列表本身保留 |
| 删除列表／解散关联文件夹 | 复用原有手工项处理规则，同时移除关联；不操作磁盘目录或动态条目 |
| AI 整理 | 目录动态条目不送入整理；有关联的容器及其中原有手工成员作为固定内容保留，其他手工内容沿用原整理能力 |
| 搜索 | 维持现有图标库和 Everything 搜索；不自动递归把整棵关联目录注册进全局图标库或搜索配置 |

这是目录映射和浏览功能，不额外实现复制、移动、重命名、删除、双向同步等文件管理器能力。现有手工项的源文件删除设置继续按原契约工作，不能把这种设置套到动态目录项。

来源：[成员合并写入 children](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/scroll/useScrollGroupController.ts)、[现有源文件删除](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/src/icons/catalog_windows/operations/mutation.rs#L127-L154)、[AI 布局读写](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/ai/aiOrganizeLayout.ts)。

### 决策五：按需刷新，不增加常驻扫描任务

- 启动台重新显示时，刷新当前可见关联列表；进入关联文件夹／子目录时读取当前层；返回时可先显示本次已读内容，再刷新这一层；提供手动刷新。
- 隐藏的列表和未进入的子目录不扫描。不轮询磁盘，也不因侧栏缩略图或布局快照扫描所有关联目录。
- 只保留当前可见目录及当前弹层导航需要的短期结果；关闭／切换关联时释放不再使用的数据。没有结果的层显示加载态，有旧结果的同一路径刷新保留旧显示。
- 根路径或当前层改变后，旧请求即使返回也不能覆盖新界面；前端按请求代次判断，复用现有 effect 清理习惯，不为此引入新的后台队列。
- 不存在或无权限时保留关联和原容器，显示“目录不存在／无法读取目录”与重试；首次读取失败没有旧内容时显示错误态，不显示“空目录”。部分读取失败保留上次完整结果，未有完整结果时显示明确失败。
- 当前目录被外部删除时不静默跳到另一个位置；保留当前位置与面包屑，允许返回父目录或重试。根目录重新出现后刷新可恢复。
- 大目录的图标只取可见项。目录区域采用按网格行计算的可见窗口，复用现有搜索结果虚拟滚动的计算方式与滚动组件；只处理新增目录区域，不改造整个手工拖拽网格。不以截断清单冒充完整目录。

本版“同步”指上述时机刷新后反映磁盘变化，不承诺窗口保持打开期间实时推送。文件系统监听留到有明确持续实时刷新需求时再加入；当前无需新依赖或常驻任务。

来源：[启动台刷新入口](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/launchpad/useLaunchpadWindowController.ts#L202-L236)、[已有结果列表可见窗口计算](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/search/SearchResultsList.tsx)、[当前仅构造活动分组网格](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src/components/icon-grid/scroll/useScrollableIconGridViewModel.ts#L121-L143)。

## 修改落点与复用清单

以下是责任落点，不要求为了凑层次逐项新建文件：

| 责任 | 新增／复用 | 预期落点 |
| --- | --- | --- |
| 按层枚举、路径范围和错误语义 | 新增一个 Rust 目录模块，复用标准库与已有图标能力 | `src-tauri/src/` 的目录模块、`commands/` 与 `lib.rs` 注册 |
| 关联字段与读取结果 | 增量类型及集中校验 | `icon-grid/model.ts`、功能内部类型／校验文件 |
| 布局持久化与空容器保护 | 扩展原流程 | `layoutStore.ts`、`scrollGroupLayout.ts`、`folderPolicy.ts` 及布局控制器 |
| 目录内容、请求状态和导航 | 共用一个目录内容模块 | `src/components/` 中集中目录功能目录 |
| 列表关联入口和直接显示 | 扩展原右键菜单，活动分组末尾组合目录区域 | `ScrollableGroupNavigation.tsx`、`ScrollableOuterGridView.tsx` 及其 view model |
| 文件夹关联入口和多层浏览 | 复用外观与外壳，局部提取共享内容容器 | `OuterFolderTile.tsx`、`FolderModalView.tsx`、`IconGrid.tsx`、`ScrollableIconGrid.tsx` |
| 图标、滚动、选择目录 | 复用现有能力，补齐尺寸／来源动作缺口 | `Icon.tsx`、`FolderVisuals.tsx`、`NativeScrollArea`、dialog 插件、可见图标加载 |
| 保存恢复／AI 共享消费者 | 保留关联字段与固定容器 | `layout-library/`、`aiOrganizeLayout.ts` 及其生成布局的调用方 |
| 可见文案 | 仅必要操作、路径导航和状态，跟随原主题／多语言 | 现有菜单、按钮、i18n 入口 |

新增持久化概念只有 `DirectoryLink`，新增运行时概念是当前层内容和导航位置。不删除原有导入、文件夹、拖拽或迁移机制。目录读取规则改在后端一处，导航与显示规则改在共用目录模块；新增第三种关联入口时仍需该入口的挂接，不承诺只改一个文件。上游现有模型、序列化和弹层仍有必要修改，避免为了零改动复制整套网格／弹层。

### 明确不采用的方案

- 递归扩展手工 `FolderItem.children`：会把磁盘层级传播到拖拽、Dock、AI、缩略图和布局迁移，扩大上游冲突面。
- 将磁盘条目批量导入托管图标库：无法直接反映目录变化，且会混入删除、隐藏与图标管理语义。
- 全局目录注册表加容器外部绑定表：当前无共享配置消费者，增加引用维护和布局恢复脱节的成本。
- 为功能直接改写上游全局布局版本号或建立另一套布局数据库：关联字段独立版本已能表达变化。
- 一次递归扫描整棵树、常驻轮询、文件管理器写操作、自动把根目录下子目录创建成多个侧栏列表：均超出本次已确认需求。

## fork 和上游同步建议

### 分支及提交组织

- fork 后 `origin` 指自己的仓库，`upstream` 指 `https://github.com/Aixbox/DesktopGo.git`。
- 保留 `desktop` 为纯上游镜像；定制主线建议 `fork/main`，可将其设为 fork 默认分支。
- 通用目录功能、fork 身份与发行配置分开提交。功能补丁按可验证行为拆分，不把代码格式化或无关重构混入。
- 同步时从定制主线新建临时同步分支，merge `upstream/desktop`，解决冲突并验证后合入。已共享／已发布主线不反复 rebase。
- 不对定制主线执行覆盖式同步。GitHub 的 Sync fork 适合纯镜像分支；同步代码与发布安装包分开。
- 如果后续愿意贡献，上游 PR 只包含通用目录能力；发行身份继续由 fork 维护。本次未向上游发送消息或 PR。

目录能力尽量作为连贯的功能提交维护：共享读取与关联文件夹闭环、列表接入、必要共享消费者适配。只为真实复用提取弹层外壳和目录内容视图；不把上游组件整份复制进 fork，不混入整库格式化或无关重命名。

每次同步重点核对四条链路：容器字段是否仍能往返保存，空／单成员关联文件夹是否被收拢，动态目录项是否进入了手工图标动作，AI／布局恢复是否重建时丢失关联。对没有关联字段的上游旧布局沿用现有验证并进行临时验收；如上游调整全局布局版本，沿用它的新版本并迁移关联字段，不长期冻结在 v9。

下列命令是后续 fork 配置完成后的操作示例，**此次未执行**：

```powershell
# origin 已指向自己的 fork，upstream 已配置
git fetch upstream
git switch desktop
git merge --ff-only upstream/desktop
git push origin desktop

git switch fork/main
git switch -c sync/upstream-20261029
git merge upstream/desktop
# 解决冲突、执行受影响验证，再通过自己的 PR 合入 fork/main
```

不能保证以后零冲突；主要冲突面会是文件夹模型、布局恢复、图标加载和发布配置。保持功能集中、绑定配置独立并争取通用能力上游化，可以缩小长期差异。

同步命令依据：[GitHub 官方 fork 同步说明](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/syncing-a-fork)。

### 独立发行前必须选择自己的身份和更新链

当前 Tauri `identifier` 为 `com.aixbox.desktopgo`，产品名、默认安装目录、更新地址和公钥均属于上游。直接沿用会继续检查上游发行版，存在被原版更新覆盖定制功能及安装／数据混用的风险。

建议独立产品名、应用 identifier、发布仓库及更新签名密钥，更新 URL 和公钥一起切换。已有原版数据若要继承，另做明确的一次性导入，不把共享原版数据目录作为默认办法。保留 MIT 原始版权和许可。

还需注意：

- `scripts/finalize-release.mjs` 在没有 `GITHUB_REPOSITORY` 时回退到 `Aixbox/DesktopGo`，并会删除、重新上传 `latest.json`。fork 应改掉该发行目标兜底。
- 现有 release workflow 为手动触发，使用仓库签名 secrets 并创建 draft；fork 需要自己的配置。
- 官网 workflow 会部署 Cloudflare，未决定维护官网前不启用该部署。
- 当前 CI 只有 Rust 质量 job，绿色不能证明前端测试和构建已通过。

来源：[Tauri 发行配置](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/tauri.conf.json#L3-L34)、[NSIS 默认安装目录](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/src-tauri/nsis/installer.nsi#L508)、[发布目标脚本](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/scripts/finalize-release.mjs#L24-L25)、[更新清单重传](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/scripts/finalize-release.mjs#L84-L95)、[release workflow](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/.github/workflows/release.yml)、[官网部署](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/.github/workflows/deploy-website.yml)、[现有 CI](https://github.com/Aixbox/DesktopGo/blob/b95939ae70ee6332a5f3181b4bd7c008fbfa54e4/.github/workflows/ci.yml)、[Tauri 更新签名说明](https://v2.tauri.app/plugin/updater/#signing-updates)。

## 实施顺序与完成条件

1. **关联文件夹闭环**：可选关联字段及兼容读写、空容器保护、按层读取命令、共享目录视图、弹层内多级导航；实现“选择目录 → 展开两级子目录 → 返回 → 重启仍保留关联”的最小路径。此阶段就保证手工布局和文件内容不被更改。
2. **列表关联**：复用同一字段、读取和内容视图，在活动列表直接呈现目录；子目录在当前内容区展开，返回根时仍在同一列表；与列表内关联文件夹共存。
3. **共享消费者与交互完整性**：完善关联菜单、目录来源动作、拖拽隔离、Dock、布局预览和恢复、AI 固定容器、中英文状态及按需图标加载；核对前两步已接入的序列化路径，补齐所有重建 payload 的消费者。
4. **Windows 集成验收**：按下表及现有检查验证全部需求。步骤是连续实施安排，不意味着只交付关联文件夹就完成本次范围，也不要求每一步另等审批。

fork 身份和更新通道作为单独变更处理；实际创建 fork、选定发行名称和仓库、提交／推送／发布属于后续相应操作。本次方案工作不执行这些动作。

## 验证方案

按用户 2026-10-29 的明确要求，本 fork 不新增自动化测试文件、用例或扩展上游用例；已移除本次新增的 15 项前端、3 项 Rust 测试，并恢复上游快捷键测试和测试加载配置。优先使用上游现有 `pnpm test`、`pnpm lint`、`pnpm build`；新增功能使用可重复的临时验收，验收资源及时清理，集成候选按范围运行仓库 Rust 检查。

| 验证层 | 必须覆盖的行为 |
| --- | --- |
| Rust 目录模块 | 只读取当前层；完整文件名；空目录与错误区别；中途读取失败；相对路径越界；普通目录／junction／符号链接及目录环；不修改文件 |
| 布局契约 | 老 v1-v9 数据无关联时行为不变；列表／文件夹关联往返保存；未知关联字段版本不丢失；零／一个手工成员时关联容器存续；提取成员、解散等动作不会误收拢仍有关联的容器 |
| 目录导航与异步状态 | 两级以上进入、返回、面包屑、关闭恢复焦点；切换目录后旧响应不覆盖新目录；更换关联根后不显示旧根结果；重新打开回到入口起点 |
| 共享消费者 | 分页／滚动中的关联文件夹；关联列表中的关联文件夹；容器移动与 Dock；分页布局库保存／预览／取消／几何变化恢复；AI 固定内容不丢失；动态条目不写入图标库或历史布局 |
| Windows Tauri 实际行为 | exe／lnk／url／文档启动正确；快捷方式参数保留；中文、空格、带点目录和同名不同扩展名；目录项不触发图标库删除／原生修改菜单；取消关联与删除虚拟容器不动源文件 |
| 刷新及失败恢复 | 外部增删改名后在显示／进入／手动刷新时更新；相同路径身份稳定；断开盘符、权限失败、删除当前层和根目录恢复；失败不当作空目录，不清空手工布局 |
| 性能 | 用至少 5,000 个直接子项的临时目录检查可见窗口、滚动、返回和刷新；进入某层不枚举其子孙；图标分批且只取可见项；隐藏的列表不扫描；不截断目录冒充完整结果 |

实际文件验收只使用本任务创建的临时目录，检查文件数量、内容及位置未变化；验收后清理临时文件和进程。前端浏览器预览只能验证呈现和导航状态，不能替代 Windows Tauri 的目录读取、快捷方式及文件启动证据。

上述矩阵区分自动化契约与实机交互；当前证据见下方实施状态，未完成项不视为已通过。

## 当前决策与未决事项（2026-10-29）

- 已确认：两个关联位置均支持，子目录在软件内逐层展开；复用现有容器和文件夹样式，优先减少上游代码分叉。
- 当前方案：容器上保存可选关联字段，动态内容独立于手工布局；一次读取当前层；刷新时机为显示／进入／手动刷新。
- 明确排除：递归手工布局模型、批量中转导入、常驻轮询、整树扫描、磁盘写操作及自动拆根目录为多个列表。
- 功能方案暂无需要阻塞实施的未决问题。独立测试包已确定名称 `DesktopGo Linked`、标识 `local.desktopgo.linked`、主程序 `desktopgo-linked.exe`，关闭上游更新；正式 fork 仓库、发行签名和更新通道仍在发布前另行确定。

本地代码位于 `E:\desktop-go` 的 `fork/main` 分支；当前 origin 仍指上游。应用代码和中英文使用指南均已更新，提交以 Git 记录为准；未推送。

## 实施状态（2026-10-29）

- 已实现：两种关联入口、按层读取、列表内／文件夹弹层内多级展开与返回、关联布局读写、空容器保留、目录项动作隔离、手工项共存、AI 固定容器、可见区域渲染及原有图标缓存复用。
- 已复用：文件夹弹层抽为 `FolderPanel`，分页和滚动网格使用共享的 `GridFolderModal` 交互接线；目录功能集中在 `src/components/directory-links/`，后端集中在 `src-tauri/src/directory.rs`。未新增依赖。
- 空图标库也允许读取布局和显示关联入口；后续刷新不再因图标库为空而卸载网格，避免目录选择器返回时丢失当前容器状态。
- `pnpm test`：沿用上游原有的 148 项前端测试，不保留本 fork 新增测试；关联目录、布局保存、尺寸及分页行为通过临时验收核对。
- `pnpm build`、`pnpm lint`：通过。ESLint 仍提示既有分页 `IconGrid.tsx` 超过 1,000 行；本次由 1,074 行缩小到 1,039 行，未扩大该遗留文件。
- `pnpm rust:quality`：此前完整通过 debug／release 严格 clippy、check、测试和文件预算；当前移除本 fork 新增用例，保留上游原有的 207 项 Rust 测试。目录按层枚举、错误区分、越界及 junction 目录环使用临时验收验证。
- 临时检查：5,000 个直接文件加一个子目录的枚举完整通过，未读取其子孙，内容未变；该大数据夹具不进入长期单测。此结果只证明后端完整枚举，不能替代窗口滚动性能验收。
- `check-changed-files.mjs` 和 `git diff --check`：通过。
- 用户已启动开发实例；已实际看到空启动台和新增菜单，用户确认目录选择框已弹出并手动取消。自动化工具未识别该原生对话框，验收中断；已按用户要求停止全部界面输入并重置自动化会话。关联创建、多层交互、重启恢复、文件打开和窗口大目录性能仍待人工验收。

项目技能要求由用户启动／停止项目进程，验收不通过代理自行重启实例。测试资源仅使用本任务创建的系统临时目录；因本次选择已取消且未创建关联，临时目录已核对并回收。

- 菜单一致性修正：空白菜单的“添加关联文件夹”移动到“添加快捷入口”旁，沿用相同图标尺寸、间距和禁用状态；列表／文件夹的关联操作对齐各自同级项并分隔危险操作；目录条目菜单复用原图标菜单的尺寸和行距。本轮仅做代码、构建与静态检查，不再自动操作用户鼠标。

- 一级列表入口修正：新增“添加关联列表”，区别于“添加关联文件夹”。两种模式共用既有侧栏布局中的关联列表，创建后留在当前模式，取消选择不改变列表。新列表置于首位并选中，复用现有分组创建／归一化与布局读写；不将源目录导入成文件夹图标。
- 封面展示：关联文件夹复用现有 `OuterFolderTile` 和 `FolderIconVisual`；只在入口接近可见区域时按层读取关联根，展示手工成员及有限数量的目录预览图标，离开可见区域后停用读取和焦点刷新。预览数据不写回手工成员或图标库，Dock 复用同一封面。新建关联文件夹默认 `2×2`，既有尺寸保留；封面文件沿用原路径启动，封面子目录通过短期打开请求进入对应相对路径，标题打开关联根。
- 当前交互修正：分页顶部列表栏复用现有 Button、图标与搜索控件表面；分页圆点抽为 `GridPageDots` 并与原分页网格共用；原分页网格通过内容插槽保留 Dock 和手工布局生命周期。目录根层没有返回按钮，也不重复显示上方列表或弹窗标题已有的名称；只保留刷新，深入子目录后再显示面包屑。列表子目录复用带动画的文件夹弹窗，弹窗内继续逐层浏览；目录导航栏使用正常文档流占位，不吸顶、不铺悬浮黑色背景，避免遮盖首排图标；目录列表不再生成空的添加行或独立内层滚动区。分页列表隐藏不适用的手工编辑操作，外部导入须切回“快捷入口”。
- 分页窗口临时检查 5,001 条记录连续分页无遗漏、末页在刷新减少后收敛、小视口至少可达一项及滚动窗口不全量渲染。沿用上游持久化测试，不新增用例。本轮只使用自动检查和用户截图，不操作鼠标；更新后的真实窗口布局、目录选择、返回焦点和滚动手感仍待用户验收。

- 2026-10-29 当前范围：用户明确忽略长按问题，要求关联目录及关联列表内的磁盘子目录均使用图中“工具”的大文件夹预览。子目录以临时 `FolderItem` 表达封面，不保存进手工成员；默认 `2×2`，按视口缩小占位，保持现有目录只读浏览语义。
- 子目录预览继续使用原关联根及当前相对路径读取，保留越界与 junction 环校验；封面子项进入原根范围内的对应相对路径。文件直接启动，标题进入完整目录，资源管理器菜单保留。
- 网格共用提取自 `buildScrollGroupEntries` 的 `domain/gridPlacement.ts` 排版核心，分页增加行边界约束，继续以 `getPageAnchorEntries` 取当前页；连续滚动保留旧入口及行为。按尺寸记录下一候选锚点，避免占用只增加时反复从头扫描；小图标可填补前面页面的大文件夹余行。纯计算检查中 5,001 个 `2×2` 项由约 1,118 ms 降至约 5 ms；此结果不代替真实窗口滚动验收。未新增依赖或磁盘修改操作。

- 子目录尺寸：`DirectoryLink.folderSizes` 保存按相对路径标识的四种尺寸，定义、读取校验和不可变更新统一在 `directory-links/domain.ts`；无需新布局表或提升布局基础版本。复用原文件夹尺寸菜单，将尺寸编辑能力与磁盘内容只读分开；窗口适配不覆盖用户所选尺寸。列表和关联文件夹分别走已有布局所有者写入，分页列表的创建／尺寸编辑串行更新同一份侧栏布局，避免连续操作覆盖。
- 尺寸交付的结构变化：新增共用排版核心，删除原滚动模块内的重复实现并保留原导出名；同一占位规则只改核心一处，目录尺寸规则只改域模块一处，布局写入仍各自属于分页列表和现有网格容器，不引入全局目录注册表。

## 提交前审查与独立测试包（2026-10-29）

审查基点为上游 `b95939ae70ee6332a5f3181b4bd7c008fbfa54e4`，结论为修复下列问题后可提交：

- P1：带 `&` 等字符的真实路径经过 `cmd /C start` 会被解释为命令语法。普通目标改用 `ShellExecuteW`，保留特殊 Shell、UWP 和运行中实例唤起分支；拒绝嵌入 NUL，避免 Win32 字符串截断。临时检查拒绝路径，不启动应用。
- P2：失效 junction／无法读取目标属性会使整层目录失败。保留条目自身类型与名称，无法解析的目录不可继续展开，仍保持根目录及导航链校验；临时验证 junction 失效目标。
- P2：关联文件夹的手工区和磁盘区各自滚动，组合后可能超出弹窗上限。关联弹窗改用同一个外层滚动区，保留手工网格及其拖拽引用，动态目录网格复用该滚动宿主。
- 独立打包隔离：使用配置覆盖文件 `src-tauri/tauri.linked.conf.json` 与命令 `pnpm build:installer:linked`；独立产品名、程序名、应用标识和安装器发布者，不生成 updater 签名产物，空更新端点阻止回到上游版本。Windows Run 注册表值从配置中的产品名取得，与安装脚本一致，避免测试版改动原版开机自启。

保留上游 MIT 版权与原始构建配置。测试包不迁移原版或开发版数据，不在本任务中安装或启动程序；首次安装、快捷键、原生文件打开及窗口多层交互仍需用户在测试包内验收。全局启动台快捷键在松开按键后复用托盘的显示／隐藏切换逻辑，窗口已显示时再次按下应收起到托盘；托盘左键和单实例唤起仍仅显示窗口。

快捷键输入框聚焦后直接录制组合键，保存前只修改草稿。录制期间释放当前启动台快捷键，避免 `Ctrl+Space` 被自身注册抢走；完成、Escape、失焦、离开常规设置及销毁设置窗口均恢复当前注册。前端串行处理暂停／恢复，保存前等待恢复结束；只按修饰键时继续等待主键，不显示错误。复用现有输入框、按键编码与注册处理，不新增键盘钩子、依赖或持久化字段。

软件可见名称以当前构建配置的 `productName` 为准。原生主窗口／设置／壁纸预览标题、托盘提示与退出菜单读取 Tauri 包信息；既有窗口初始化脚本向前端提供名称、版本及应用标识，Logo、文案和关于页回退信息共用该值。文案通过 `{appName}` 插值，安装器语言文件复用 `${PRODUCTNAME}`，不全局替换用户数据、内部键、上游链接或版权。普通浏览器预览沿用基础配置，独立安装包使用 Linked 覆盖配置。

- 2026-10-29 弹窗动效：列表子目录复用 `FolderPanel`、现有共享 `layoutId` 和动画配置；新增 `DirectoryDialog` 只负责弹窗生命周期与滚动宿主，目录视图自行选择弹窗入口或弹窗内导航。列表视图不卸载，关闭完成后释放源封面的共享 ID 并恢复焦点。弹窗闲置时不拦截指针；Escape 不穿透关闭主窗口；减少动态效果时不执行共享形变。面包屑临时检查覆盖 Windows 分隔符及打开目录边界，未新增持久化字段或动画依赖。
