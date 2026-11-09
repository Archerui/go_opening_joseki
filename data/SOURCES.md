# 离线定式数据库：来源与编译

这份数据库使用公开发布的 SGF 变化树。它保存推荐变化、源中明确标注的错着、规避变化，以及它们已有的后续；不调用 AI，不按胜率自动补造棋步，不把未收录的点判成恶手。

本次快照下载于 **2026-10-31**。统计由 `stats.json` 自动生成：16,531 个树节点、16,454 手棋、3,507 个叶变化。叶变化是从一棵源树根到叶子的路线，**不是 3,507 个不同名称的定式**，不同来源可能收录相同变化。

## 收录来源

| 来源 | 收录内容 | 原发布许可 | 本地文件 |
| --- | --- | --- | --- |
| [Pachi](https://github.com/pasky/pachi/tree/master/joseki) | 三三、小目、星位、高目共 4 个 SGF；正常应法和偏离应对 | GPL-2.0-only | `raw/pachi/`，许可证 `COPYING` |
| [GNU Go](https://www.gnu.org/software/gnugo/) | 星位小飞挂、星位其他变化、小目、三三、目外、高目、五五共 7 个 SGF | GPL-3.0-or-later | `raw/gnugo/`，许可证 `COPYING` |
| [Josekle](https://github.com/okonomichiyaki/josekle/tree/master/sgf) | `dictionary.sgf` 中完整的 OGS GOOD/IDEAL 筛选树 | MIT（上游仓库声明） | `raw/josekle/`，许可证 `LICENSE` |

每个输入的原始 URL、固定 Git 提交、SHA-256 和大小都保存在 `source-manifest.json`。GNU Go 的 GitHub 镜像为 [runningskull/gnugo](https://github.com/runningskull/gnugo)，其 SGF 文件自身带有 Free Software Foundation 的版权与 GPL 声明。原始 SGF、许可证和用于解读标记的上游文档/代码均完整保留。

生成文件中的各来源记录保留各自许可，不因合并打包而重新许可。分发这份数据时，应同时保留 `raw/`、许可证、来源清单以及构建脚本；项目界面代码的许可与这些数据来源分别处理。

## 评价的含义

颜色表示**这个来源在该局部中的记录**，不表示 AI 分数或全盘最优。

- `good`：来源采用的变化。Pachi 未被排除的应法、GNU Go 正常/紧急等应法，以及 Josekle 抓取的 OGS GOOD/IDEAL。
- `bad`：当前棋步有明确错着证据。仅使用 Pachi `<bad>`、SGF `BM`，以及 GNU Go 中少量明确描述当前棋步错误的注释。保留所有已给出的后续，不保证每个错着都附有完整惩罚。
- `questionable`：存疑、嵌手、需条件判断、或引擎规避。Pachi 的 `<don't>` / `<avoid>`，GNU Go 的 `0` / `A` / `a` / `T` 等都不能无条件当成实战恶手：例如高目起手也可能因引擎暂不掌握而被排除。
- `unknown`：没有棋步评价的元数据节点，或未来导入的未评级棋步。无数据库匹配的用户自由落子也应保持未评级。

每个节点附有 `qualityEvidence`，原始注释保存在 `rawComment`；精简后的可显示文字在 `comment` 中。GNU Go 带运行条件的模式标记为 `conditional`，条件不在浏览器中自动求解。`LB`、`TR`、`MA` 等图形标记保留在 `marks`，从不当成好坏证据。SGF `GB` / `GW` 是局面评价，也不用于判定当前棋步。

Pachi 标记的解释见上游 [joseki/README](https://github.com/pasky/pachi/blob/master/joseki/README)，本地保留于 `raw/pachi/README`。GNU Go 的标签解释以 `raw/gnugo/joseki.c` 的 `identify_move_type` 为准，也可参阅 [GNU Go 定式编译器文档](https://www.gnu.org/software/gnugo/gnugo_9.html)。

Josekle 的 `raw/josekle/scrape.rb` 明确只筛选 OGS `GOOD` 和 `IDEAL`。其导出没有保存这两级的区别、原文解说、错误分支或定式名，因此不推造这些信息。原始 `C[数字]` 是 OGS 条目编号，转存为 `externalId`，可访问 `https://online-go.com/joseki/<编号>` 核对。OGS 数据通过该 MIT 仓库公开发布的快照导入；未另行批量抓取 OGS 站点或其用户评论。

## 为什么没有直接打包 Kogo 整库

已检索 [Kogo 官方下载页](https://waterfire.us/joseki.htm) 和 [官方 FAQ](https://waterfire.us/go/kjd_info.htm)。尽管公开提供免费下载，FAQ 明确要求再分发前取得许可，SGF 头部也保留版权说明。本项目不把可下载等同于允许整库再分发，因此没有捆绑 Kogo 原始文件或全文注释。原项目已经整理的少量中文精选内容由界面的精选数据模块另行管理，不属于这份批量导入库。

## 重建与验证

在 `template/` 目录运行：

```sh
python3 scripts/build-joseki.py
python3 scripts/verify-joseki.py
```

默认构建完全离线，并校验全部输入的 SHA-256。若需从固定提交恢复原始文件：

```sh
python3 scripts/build-joseki.py --fetch
```

`verify-joseki.py` 遍历每个节点，检查父子指针、无循环、落点范围、占位冲突、提子和自杀；同时报告同父同点重复分支。允许原谱中的同色连续着，因为这些表示对方脱先之后的应对。它不判断棋力、征子结果或全盘适用性。

输出 `joseki-db.js` 使用普通 `window.JOSEKI_DB` 全局变量，可在 `file://` 下用 `<script>` 载入，不依赖 fetch、服务器或网络。上游树按来源分开，源中没有同父同点重复着；跨源相同棋形保留各自上下文。

## 数据接口

```text
JOSEKI_DB = { version, builtAt, boardSize, sources, stats, roots, collections, nodes }
collection = { id, title, root, sourceId }
node = {
  id, parent, move, children, quality, qualityEvidence,
  name, comment, sourceId, sourceFile, sourceNode, depth,
  setup?, toPlay?, rawComment?, marks?, externalId?, conditional?, condition?
}
move = { color: "B" | "W", x, y, pass?: true }
setupStone = { color: "B" | "W" | "E", x, y }
```

`id` 等于 `nodes` 数组下标；`parent` 为 `null` 的节点是源树根。坐标从棋盘左上角开始，以 0 为起点。停一手/脱先的 `pass` 为 `true`，坐标为 `-1,-1`；`E` 表示 SGF `AE` 清空摆子。`move:null` 是说明或摆子节点，界面应穿过它继续查找下一棋步，不应多计一手。`depth` 只计算原谱中棋步节点，包含脱先/停一手。每个来源文件中的 `sourceNode` 是从 1 开始的深度优先节点序号，便于回查源文。

名称仅使用原谱 `N` 属性或集合标题；未命名的变化应显示所属定式族，不能把普通形状描述冒充固定定式名。


## 名称与已核实次序

开局手法名称及截图三三变化另见 [NAMING-AND-ORDER.md](NAMING-AND-ORDER.md)。`reviewed-sansan.json` 保存有来源的局面顺序和定式终点；它是独立核实层，不改变原始源库，也不把新增元数据重复算入棋谱数量。
