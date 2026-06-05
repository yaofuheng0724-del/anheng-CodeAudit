# Compiled Scan Mode — 编译后产物扫描模式设计规范

## 概述

为 DeepAudit 快速审计任务增加「编译后产物扫描」模式,让用户可上传包含 Android 产物 (.apk/.aab/.dex) 和 C/C++ 原生二进制 (.so/.dll/.exe/.elf) 的压缩包,由新增的 `CompiledScanEngine` 进行轻量级元数据扫描与 SCA 分析。现有的源代码扫描流程完全不受影响。

## 背景

用户需要在无法获取源代码的场景下(如第三方 SDK、开源组件、客户交付物)仍能发现安全风险。当前 DeepAudit 仅支持 Git 仓库和源码压缩包,所有二进制文件被 `is_text_file` 过滤丢弃。此次扩展不涉及反编译/反汇编,完全通过元数据、字符串提取和库版本指纹实现轻量级扫描。

## 关键决策

| 决策 | 结论 | 理由 |
|---|---|---|
| C/C++ 二进制深度 | 轻量级(符号+字符串+SCA) | MVP 阶段无需集成 Ghidra,后续可按需扩展 |
| Android 处理方式 | 静态元数据+SCA | 仅提取 Manifest/权限/SDK 指纹,不做 jadx 全量反编译 |
| 引擎架构 | 新增独立 `CompiledScanEngine` | 职责清晰,零侵入现有源码扫描路径 |
| 后端 Java(.jar/.war) | 不支持 | 本次只做 Android + C/C++,YAGNI |
| Python .pyc / .NET .dll | 不支持 | 同上 |

## 数据模型

### AuditTask.scan_config 新增字段

```jsonc
{
  // ... 已有字段
  "scan_mode": "source" | "compiled",       // 新增,默认 "source"
  "compiled_options": {                     // 仅 scan_mode="compiled" 时有效
    "enable_sca": true,                     // 是否做 CVE 库版本匹配
    "max_binary_size_mb": 200               // 单文件上限,默认 200MB
  }
}
```

- `scan_mode` 字段在 `ScanRequest` Pydantic 模型中新增,默认 `"source"`
- 无需数据库 schema 迁移,`scan_config` 已是 Text JSON 列

## 引擎架构

### 目录结构

```
backend/app/services/compiled_scan/
├── __init__.py
├── engine.py                # CompiledScanEngine 主入口
├── collector.py             # collect_compiled_artifacts()
├── analyzers/
│   ├── __init__.py
│   ├── base.py              # CompiledAnalyzer 抽象基类
│   ├── apk_analyzer.py      # .apk/.aab/.dex → Manifest/权限/SDK
│   ├── binary_analyzer.py   # .so/.dll/.exe/.elf → 符号/字符串
│   └── sca_analyzer.py      # 库版本指纹 → CVE 匹配
├── rules/
│   ├── dangerous_functions.yml   # strcpy/system/popen 等危险函数符号
│   ├── android_permissions.yml   # 高危 Android 权限列表
│   ├── secret_patterns.yml       # 硬编码密钥/URL/Token 正则
│   └── known_libs.yml            # 库指纹 → CVE 映射(首版 ~30 条)
└── utils/
    ├── elf_parser.py         # pyelftools 封装
    ├── pe_parser.py          # pefile 封装
    └── apk_parser.py         # androguard 封装
```

### 接口定义

```python
# analyzers/base.py
class CompiledAnalyzer(ABC):
    name: str
    supported_extensions: set[str]

    @abstractmethod
    def applies_to(self, file_path: Path) -> bool: ...
    @abstractmethod
    def analyze(self, file_path: Path, options: dict) -> list[Finding]: ...

# engine.py — 编排
class CompiledScanEngine:
    def __init__(self):
        self.analyzers = [ApkAnalyzer(), BinaryAnalyzer(), SCAAnalyzer()]
    def scan(self, workspace: Path, options: dict) -> list[Finding]:
        artifacts = collect_compiled_artifacts(workspace)
        findings = []
        for artifact in artifacts:
            for analyzer in self.analyzers:
                if analyzer.applies_to(artifact):
                    findings.extend(analyzer.analyze(artifact, options))
        return deduplicate_findings(findings)
```

### 分析器职责

| 分析器 | 输入 | 提取内容 | 匹配规则 |
|---|---|---|---|
| `ApkAnalyzer` | .apk/.aab/.dex | AndroidManifest(权限/组件/导出)、签名信息、第三方 SDK 前缀、字符串(密钥/OAuth/URL) | 高危权限、混淆不足、硬编码凭证、已知 SDK 版本漏洞 |
| `BinaryAnalyzer` | .so/.dll/.exe/.elf | 符号表(导入/导出)、`.rodata` 字符串表、链接器脚本、编译标志 | `dangerous_functions.yml`(危险 API 引用)、`secret_patterns.yml` |
| `SCAAnalyzer` | 所有文件(跨目标) | 库名+版本(符号特征/元数据/soname) | `known_libs.yml`(库指纹→CVE 映射) |

### 文件收集器

`collect_compiled_artifacts(workspace)` 走二进制扩展名白名单(`is_text_file` 的镜像):

```python
COMPILED_EXTENSIONS = {
    # Android
    ".apk", ".aab", ".dex",
    # Native binaries
    ".so", ".dll", ".exe", ".elf",
    # 无扩展名的 Unix 可执行文件需要通过 magic bytes 识别(后续版本)
}
```

- 单文件超过 `max_binary_size_mb` 时跳过并产生 info finding
- 复用现有 `extract_archive_recursive` 递归解压,支持嵌套 zip
- `exclude_patterns` 继续生效(用户可排除某些子目录)

### 现有 scanner.py 接入点

```python
# backend/app/services/scanner.py
def scan_local_workspace(workspace, user_config, ...):
    scan_mode = user_config.get("scan_config", {}).get("scan_mode", "source")

    if scan_mode == "compiled":
        findings = CompiledScanEngine().scan(workspace, user_config)
        persist_findings(task_id, findings)
        return  # 源码扫描路径完全跳过

    # ↓ 以下为现有源码扫描,零改动
    source_files = collect_source_files(workspace)
    ...
```

## 前端 UI 改动

### CreateTaskDialog.tsx

在 `auditMode === 'fast'` 分支下新增「扫描类型」单选组:

**扫描类型**
- ● 源代码 (Git 仓库 / 源码压缩包)
- ○ 编译后产物 (.apk/.so/.dll/.exe...)

切换为「编译后产物」时:
- **隐藏**: 规则集下拉、prompt template 下拉、Git 仓库项目入口、`functionWhitelist`/`vulnerabilityWhitelist`/`sanitizerFunctions`
- **显示**: SCA 开关 (`☑ 启用第三方库 CVE 匹配`)、单文件大小上限输入
- 文件选择器 accept 保持压缩包扩展名不变

提交时:
```ts
scanZipFile({ ...existing, scan_mode: 'compiled',
  compiled_options: { enable_sca: true, max_binary_size_mb: 200 } })
```

### TaskDetail.tsx 微调

- 标题区 badge: `[源代码扫描]` 或 `[编译后扫描]`
- AuditIssue 列表: `line_number: 0` 时不显示行号,改为显示来源标签如 `[符号引用]` / `[字符串匹配]` / `[CVE]`

### 字段约定

编译扫描模式产出的 `AuditIssue` 字段约定(无 schema 改动):
- `file_path`: 压缩包内的相对路径(如 `libs/arm64-v8a/libfoo.so`)
- `line_number`: 固定为 `0`(表示「非行级定位」),前端据此切换显示模式
- `code_snippet`: 渲染内容根据 finding 类型不同 —— 反汇编片段 / 字符串上下文 / CVE 描述 / Manifest XML 片段
- `rule_id`: 形如 `compiled.binary.dangerous_func.strcpy` / `compiled.apk.permission.READ_SMS` / `compiled.sca.CVE-2014-0160`

## 依赖

| Python 包 | 用途 | 安装方式 |
|---|---|---|
| `pyelftools` (纯 Python) | ELF 文件解析 | `pip install pyelftools` |
| `pefile` (纯 Python) | PE 文件解析 | `pip install pefile` |
| `androguard` (纯 Python) | APK/DEX 元数据解析 | `pip install androguard` |

Dockerfile 无需额外系统依赖,三个包均可通过 pip 安装。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 解析极端/畸形文件崩溃 | 每个 analyzer 用 try/except 包裹,失败时产生 warning finding |
| 大文件(>200MB)耗时/OOM | `max_binary_size_mb` 硬上限,超限文件跳过并产出 info finding |
| 误报(危险函数符号≠实际漏洞) | severity 默认 `info`/`low`,描述明示「需人工确认」 |
| 已知库 CVE 库陈旧 | 首版手工维护 ~30 条,文档化更新流程 |
| 依赖包体积大 | 三个包均纯 Python,无系统命令依赖 |

## 测试策略

### 单元测试 (backend/tests/services/compiled_scan/)

测试夹具:
```
tests/fixtures/compiled/
├── hello.elf           # 含 strcpy 调用
├── hello.dll           # 导入 system
├── sample.apk          # 含 INTERNET 权限 + 硬编码密钥
└── libssl-1.0.0.so     # 已知 CVE 库版本
```

覆盖:
- `BinaryAnalyzer` 从 ELF/PE 提取危险函数引用
- `ApkAnalyzer` 解析高危权限和第三方 SDK
- `SCAAnalyzer` 匹配 OpenSSL 1.0.0 → CVE-2014-0160
- `Collector` 忽略 .txt/.java 等非二进制文件
- `Engine` `scan_mode='compiled'` 时跳过 Semgrep/Pattern

### 集成测试
- 上传混合压缩包(1 .apk + 1 .so + 1 .txt) → 断言 AuditIssue 数量与类型
- `scan_mode='source'` 时现有全部源码测试全绿

## 实施顺序

### 1. 后端基础设施
- 创建 `compiled_scan/` 目录骨架(base.py + engine.py + collector.py)
- `scan_local_workspace` 加 `scan_mode` 分支
- `ScanRequest` Pydantic 模型加 `scan_mode` / `compiled_options` 字段
- 单测验证分支正确(compiled 模式返回空,source 模式走原路)

### 2. BinaryAnalyzer + 危险函数规则
- `pyelftools`/`pefile` 集成
- 符号表 + 字符串提取
- `dangerous_functions.yml` + `secret_patterns.yml` 规则
- ELF/PE 测试夹具

### 3. ApkAnalyzer
- `androguard` 集成
- Manifest 权限 + SDK 指纹 + 字符串
- APK 测试夹具

### 4. SCAAnalyzer
- `known_libs.yml` (~30 条最常见库 + CVE)
- 库名/版本提取逻辑

### 5. 前端 UI
- `CreateTaskDialog` 扫描类型单选 + 提交字段
- `TaskDetail` badge + issue 行号适配

每阶段可独立合并,不破坏现有源码扫描流程。

## 范围明确排除 (YAGNI)

- ❌ 深度反编译/反汇编(Ghidra/jadx)
- ❌ 后端 Java (.jar/.war/.class)
- ❌ Python .pyc / .NET .dll
- ❌ 新 endpoint / 新数据表
- ❌ ScanEngine 全局抽象重构