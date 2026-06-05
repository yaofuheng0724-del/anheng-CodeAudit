"""
本地快速扫描引擎。
"""

from __future__ import annotations

import fnmatch
import json
import os
import re
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from app.core.config import settings


TEXT_EXTENSIONS = {
    # ---- JavaScript / TypeScript ----
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    # ---- Python ----
    ".py": "python",
    ".pyi": "python",
    ".pyw": "python",
    # ---- Java / JVM ----
    ".java": "java",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".groovy": "groovy",
    ".gradle": "gradle",
    ".properties": "properties",
    # ---- Go ----
    ".go": "go",
    # ---- PHP ----
    ".php": "php",
    ".phtml": "php",
    # ---- Ruby ----
    ".rb": "ruby",
    ".erb": "ruby",
    ".haml": "ruby",
    # ---- Swift / Objective-C ----
    ".swift": "swift",
    ".m": "objective-c",
    ".mm": "objective-c",
    # ---- C / C++ ----
    ".c": "cpp",
    ".h": "cpp",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hh": "cpp",
    ".hxx": "cpp",
    ".cuh": "cpp",
    ".cu": "cpp",
    # ---- C# ----
    ".cs": "csharp",
    # ---- Rust ----
    ".rs": "rust",
    # ---- Shell ----
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".fish": "shell",
    ".ps1": "powershell",
    ".bat": "batch",
    ".cmd": "batch",
    # ---- Web / Frontend ----
    ".html": "html",
    ".htm": "html",
    ".xhtml": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "scss",
    ".less": "less",
    ".styl": "stylus",
    ".vue": "vue",
    ".svelte": "svelte",
    ".astro": "astro",
    # ---- Markup / Config / Data ----
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".ini": "ini",
    ".cfg": "ini",
    ".conf": "ini",
    ".json": "json",
    ".json5": "json",
    ".jsonc": "json",
    ".xml": "xml",
    ".svg": "xml",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".proto": "protobuf",
    ".csv": "csv",
    ".env": "env",
    ".editorconfig": "editorconfig",
    # ---- Docker / CI / DevOps ----
    ".dockerfile": "dockerfile",
    ".cmake": "cmake",
    ".make": "makefile",
    ".mk": "makefile",
    # ---- Mobile ----
    ".dart": "dart",
    # ---- Other languages ----
    ".lua": "lua",
    ".r": "r",
    ".R": "r",
    ".pl": "perl",
    ".pm": "perl",
    ".ex": "elixir",
    ".exs": "elixir",
    ".erl": "erlang",
    ".hs": "haskell",
    ".zig": "zig",
    ".nim": "nim",
    ".sol": "solidity",
    ".wasm": "wasm",
    # ---- Terraform ----
    ".tf": "terraform",
    ".tfvars": "terraform",
    # ---- JSP / ASP ----
    ".jsp": "jsp",
    ".jspx": "jsp",
    ".asp": "asp",
    ".aspx": "asp",
    # ---- Docs ----
    ".md": "markdown",
    ".mdx": "markdown",
    ".txt": "text",
    ".rst": "rst",
    # ---- Lock / Manifest (important for dependency audit) ----
    ".lock": "lockfile",
    ".pip": "pip",
}

SPECIAL_FILENAMES = {
    "dockerfile": "dockerfile",
    "makefile": "makefile",
    "gemfile": "ruby",
    "rakefile": "ruby",
    "vagrantfile": "ruby",
    "jenkinsfile": "groovy",
    "babel.config.js": "javascript",
    "next.config.js": "javascript",
    "next.config.mjs": "javascript",
    "next.config.ts": "typescript",
    "vite.config.js": "javascript",
    "vite.config.ts": "typescript",
    "webpack.config.js": "javascript",
    "rollup.config.js": "javascript",
    "tsconfig.json": "typescript",
    "package.json": "json",
    "composer.json": "json",
    "pom.xml": "xml",
    "build.gradle": "gradle",
    "build.gradle.kts": "kotlin",
    "cargo.toml": "toml",
    "go.mod": "go",
    "go.sum": "go",
    "requirements.txt": "text",
    "pipfile": "text",
    "pyproject.toml": "toml",
    "setup.py": "python",
    "setup.cfg": "ini",
    ".gitignore": "gitignore",
    ".dockerignore": "gitignore",
    ".npmrc": "ini",
    ".yarnrc": "ini",
    ".eslintrc": "json",
    ".eslintrc.js": "javascript",
    ".eslintrc.cjs": "javascript",
    ".eslintrc.json": "json",
    ".eslintrc.yaml": "yaml",
    ".eslintrc.yml": "yaml",
    ".prettierrc": "json",
    ".prettierrc.js": "javascript",
    ".prettierrc.json": "json",
    ".prettierrc.yaml": "yaml",
    ".prettierrc.yml": "yaml",
    ".babelrc": "json",
    ".env": "env",
    ".env.local": "env",
    ".env.development": "env",
    ".env.production": "env",
    ".env.test": "env",
}

DEFAULT_EXCLUDES = [
    "node_modules/**",
    "vendor/**",
    ".git/**",
    ".svn/**",
    ".hg/**",
    "dist/**",
    "build/**",
    "target/**",
    "__pycache__/**",
    "*.min.js",
    "*.map",
]

PATTERN_RULES = [
    {
        "rule_id": "DA-SQLI-001",
        "title": "可能存在 SQL 注入",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "使用参数化查询或 ORM 安全接口，不要拼接不可信输入。",
        "source_desc": "不可信输入拼接至 SQL 语句",
        "sink_desc": "SQL 执行函数 (execute/rawQuery/prepareStatement)",
        "languages": {"python", "java", "javascript", "typescript", "php", "go", "cpp"},
        "patterns": [
            r"(execute(Query|Update)?|rawQuery|createQuery|prepareStatement)\s*\([^)]*(\+|%s|f\"|f'|\{)",
            r"SELECT\s+.+\s+(FROM|WHERE).*(\+|%s|\{)",
        ],
    },
    {
        "rule_id": "DA-XSS-001",
        "title": "可能存在 XSS 风险",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "避免将不可信输入直接写入 HTML，统一进行输出编码或使用安全渲染组件。",
        "source_desc": "不可信输入未编码直接输出至 HTML",
        "sink_desc": "HTML 输出函数 (innerHTML/document.write/dangerouslySetInnerHTML)",
        "languages": {"javascript", "typescript", "php", "java", "python"},
        "patterns": [
            r"dangerouslySetInnerHTML",
            r"innerHTML\s*=",
            r"document\.write\s*\(",
            r"render_template_string\s*\(",
        ],
    },
    {
        "rule_id": "DA-SSRF-001",
        "title": "可能存在 SSRF 风险",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "限制可访问的目标地址，校验协议、域名/IP，并使用服务端白名单。",
        "source_desc": "用户控制的 URL/URI 参数",
        "sink_desc": "HTTP 请求函数 (requests/axios/fetch/urlopen/RestTemplate)",
        "languages": {"python", "javascript", "typescript", "java", "go", "php", "swift", "objective-c"},
        "patterns": [
            r"(requests|httpx|axios|fetch|urlopen|RestTemplate|HttpURLConnection|NSURLSession|NSURLConnection).*(url|uri|endpoint|host)",
        ],
    },
    {
        "rule_id": "DA-CMDI-001",
        "title": "可能存在命令注入",
        "issue_type": "security",
        "severity": "critical",
        "suggestion": "避免把外部输入传给系统命令；必须执行时使用参数数组并做严格白名单校验。",
        "source_desc": "外部输入传入系统命令",
        "sink_desc": "命令执行函数 (os.system/subprocess/Runtime.exec/ProcessBuilder)",
        "languages": {"python", "javascript", "typescript", "java", "php", "ruby", "go", "swift", "objective-c"},
        "patterns": [
            r"os\.system\s*\(",
            r"subprocess\.(run|Popen|call)\s*\(",
            r"Runtime\.getRuntime\(\)\.exec\s*\(",
            r"ProcessBuilder\s*\(",
            r"(exec|system|popen|shell_exec)\s*\(",
            r"NSTask\s*\(",
        ],
    },
    {
        "rule_id": "DA-PATH-001",
        "title": "可能存在路径遍历风险",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "对文件路径做归一化和目录白名单校验，禁止直接使用用户传入路径访问文件系统。",
        "source_desc": "用户传入的文件路径参数",
        "sink_desc": "文件系统访问函数 (open/FileInputStream/readFile/fopen/os.Open)",
        "languages": {"python", "javascript", "typescript", "java", "php", "go", "ruby", "swift", "objective-c"},
        "patterns": [
            r"(\.\./|\.\.\\\\)",
            r"(open|FileInputStream|readFile|fopen|os\.Open|Files\.read).*(path|filename|file_path)",
        ],
    },
    {
        "rule_id": "DA-SECRET-001",
        "title": "可能存在硬编码密钥",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "将密钥迁移到环境变量或密钥管理系统，不要硬编码在仓库中。",
        "source_desc": None,
        "sink_desc": None,
        "languages": set(TEXT_EXTENSIONS.values()),
        "patterns": [
            r"(secret|api[_-]?key|token|access[_-]?key|password)\s*[:=]\s*[\"'][^\"']{8,}[\"']",
        ],
    },
    {
        "rule_id": "DA-CRYPTO-001",
        "title": "可能使用弱加密算法",
        "issue_type": "security",
        "severity": "medium",
        "suggestion": "避免使用 MD5、SHA1、DES、RC4 等弱算法，优先使用现代安全算法。",
        "source_desc": None,
        "sink_desc": None,
        "languages": set(TEXT_EXTENSIONS.values()),
        "patterns": [
            r"\b(md5|sha1|des|rc4)\b",
        ],
    },
    {
        "rule_id": "DA-CPP-001",
        "title": "C/C++ 不安全字符串操作",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "避免使用 strcpy/gets/sprintf 等不安全函数，改用带边界检查的实现。",
        "source_desc": "外部输入拷贝至固定缓冲区",
        "sink_desc": "无边界检查的字符串操作函数 (strcpy/gets/sprintf)",
        "languages": {"cpp"},
        "patterns": [
            r"\b(strcpy|strcat|gets|sprintf|vsprintf|scanf)\s*\(",
        ],
    },
    {
        "rule_id": "DA-JAVA-RESOURCE-001",
        "title": "Java 资源对象可能未释放",
        "issue_type": "security",
        "severity": "medium",
        "suggestion": "使用 try-with-resources 或 finally 块确保流、socket、数据库连接被正确关闭。",
        "source_desc": None,
        "sink_desc": None,
        "languages": {"java"},
        "patterns": [
            r"new\s+(FileInputStream|FileOutputStream|BufferedReader|BufferedWriter|Socket|Connection)\s*\(",
        ],
    },
    {
        "rule_id": "DA-AUTH-001",
        "title": "可能存在权限绕过或未授权访问",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "在敏感接口前补充服务端鉴权和角色校验，避免仅依赖前端或客户端参数。",
        "source_desc": "客户端可控的权限/角色参数",
        "sink_desc": "权限校验逻辑 (is_admin/role/permission 判断)",
        "languages": {"python", "javascript", "typescript", "java", "php", "go", "swift", "objective-c"},
        "patterns": [
            r"(is_admin|isAdmin|role|permission).*(request|params|query|body)",
            r"(admin|role)\s*==\s*(request|getParameter|req\.query|req\.body|params)",
        ],
    },
    # =================== Java 特定规则 ===================
    {
        "rule_id": "DA-JAVA-SQLI-002",
        "title": "Java 中可能存在 SQL 注入（JDBC/Hibernate/JPA）",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "使用 PreparedStatement 参数化绑定，避免拼接字符串构造 SQL；Hibernate/JPA 应使用命名参数或 Criteria API。",
        "source_desc": "不可信输入拼接至 SQL 语句",
        "sink_desc": "SQL 执行函数 (statement.execute/createQuery/createNativeQuery)",
        "languages": {"java", "jsp"},
        "patterns": [
            r"statement\.execute(Query|Update)?\s*\([^)]*\+",
            r"createQuery\s*\([^)]*(\+|%|f\")",
            r"createNativeQuery\s*\([^)]*(\+|%|f\")",
            r"\.createSQLQuery\s*\([^)]*(\+|%)",
            r"PreparedStatement.*\+\s*\"",
        ],
    },
    {
        "rule_id": "DA-JAVA-XSS-002",
        "title": "Java/JSP 中可能存在 XSS 风险",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "对输出到 HTML 的数据做统一编码（OWASP Encoder 或 JSTL c:out），避免 JSP 脚本/表达式直接输出 request 参数。",
        "source_desc": "不可信输入未编码直接输出至 HTML",
        "sink_desc": "HTML 输出函数 (response.getWriter/out.print/JspWriter)",
        "languages": {"java", "jsp"},
        "patterns": [
            r"response\.getWriter\(\)\.(?:print|write)\s*\(",
            r"<%=\s*request\.getParameter",
            r"<%\s*out\.print(?:ln)?",
            r"JspWriter.*print\s*\([^)]*request",
            r"Model(?:AndView)?\.addAttribute\s*\([^,]*request",
        ],
    },
    {
        "rule_id": "DA-JAVA-SSRF-002",
        "title": "Java 中可能存在 SSRF 风险",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "对用户传入的 URL/URI 做白名单校验，禁止请求内网地址；优先使用 SSRF-safe 的 HTTP 客户端封装。",
        "source_desc": "用户控制的 URL/URI 参数",
        "sink_desc": "HTTP 请求函数 (RestTemplate/HttpClient/OkHttpClient/WebClient)",
        "languages": {"java"},
        "patterns": [
            r"new\s+URL\s*\([^)]*(?:request|getParameter|param)",
            r"RestTemplate\s*\.\s*(?:get|post|exchange|execute)\s*\([^)]*(?:request|getParameter|url|uri)",
            r"HttpURLConnection\s*.*(?:request|getParameter|url)",
            r"HttpClient\s*.*(?:request|getParameter|url)",
            r"OkHttpClient.*new\s+Request\s*\.\s*url\s*\([^)]*(?:request|getParameter|param)",
            r"WebClient\s*\.\s*(?:get|post)\s*\(\s*uri\s*\([^)]*(?:request|getParameter|param)",
        ],
    },
    {
        "rule_id": "DA-JAVA-CMDI-002",
        "title": "Java 中可能存在命令注入（拼接输入到 Runtime/ProcessBuilder）",
        "issue_type": "security",
        "severity": "critical",
        "suggestion": "禁止将外部输入传入 Runtime.exec 或 ProcessBuilder；必须执行命令时使用固定参数列表，对输入做严格白名单校验。",
        "source_desc": "外部输入传入系统命令",
        "sink_desc": "命令执行函数 (Runtime.exec/ProcessBuilder/ScriptEngine.eval)",
        "languages": {"java"},
        "patterns": [
            r"Runtime\.getRuntime\(\)\.exec\s*\([^)]*(?:\+|request|getParameter)",
            r"ProcessBuilder\s*\([^)]*(?:\+|request|getParameter)",
            r"ScriptEngine\s*\.\s*eval\s*\([^)]*\+",
        ],
    },
    {
        "rule_id": "DA-JAVA-PATH-002",
        "title": "Java 中可能存在路径遍历风险（File/Path API 拼接外部输入）",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "对文件路径做归一化（Path.normalize()）和目录白名单校验，禁止直接使用 request 参数构造路径。",
        "source_desc": "用户传入的文件路径参数",
        "sink_desc": "文件系统访问函数 (new File/Paths.get/FileInputStream/FileOutputStream)",
        "languages": {"java"},
        "patterns": [
            r"new\s+File\s*\([^)]*(?:\+|request\.getParameter)",
            r"Paths\.get\s*\([^)]*(?:\+|request\.getParameter)",
            r"new\s+FileInputStream\s*\([^)]*(?:\+|request\.getParameter)",
            r"new\s+FileOutputStream\s*\([^)]*(?:\+|request\.getParameter)",
            r"FileReader\s*\([^)]*(?:\+|request\.getParameter)",
            r"ResourceUtils\.getFile\s*\([^)]*(?:request|param)",
        ],
    },
    {
        "rule_id": "DA-JAVA-SECRET-002",
        "title": "Java 配置/代码中可能硬编码密码",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "将密码迁移到环境变量、Vault 或配置中心；禁止在源码和 .properties 中硬编码明文密码。",
        "source_desc": None,
        "sink_desc": None,
        "languages": {"java", "jsp", "properties"},
        "patterns": [
            r"setPassword\s*\(\s*\"[^\"]{4,}\"",
            r"\"password\"\s*:\s*\"[^\"]{4,}\"",
            r"password\s*=\s*[^\s]{4,}",
            r"spring\.datasource\.password\s*=\s*[^\s]{4,}",
            r"jdbc\.password\s*=\s*[^\s]{4,}",
        ],
    },
    {
        "rule_id": "DA-JAVA-CRYPTO-002",
        "title": "Java 中可能使用弱加密算法",
        "issue_type": "security",
        "severity": "medium",
        "suggestion": "避免 MD5/SHA1 用于安全场景，改用 SHA-256+；避免 DES/RC4/Blowfish 加密，改用 AES-256-GCM。",
        "source_desc": None,
        "sink_desc": None,
        "languages": {"java"},
        "patterns": [
            r"MessageDigest\.getInstance\s*\(\s*\"(?:MD5|SHA-?1)\"",
            r"Cipher\.getInstance\s*\(\s*\"(?:DES|RC4|RC2|Blowfish)",
            r"DESKeySpec",
            r"SecretKeySpec\s*\([^)]*\"(?:DES|RC4|RC2|Blowfish)",
            r"KeyGenerator\.getInstance\s*\(\s*\"(?:DES|RC4|ARC4)",
        ],
    },
    {
        "rule_id": "DA-JAVA-RESOURCE-002",
        "title": "Java 数据库连接/网络资源可能未释放",
        "issue_type": "security",
        "severity": "medium",
        "suggestion": "对 Connection、Statement、Socket 等资源使用 try-with-resources 或在 finally 中确保 close()。",
        "source_desc": None,
        "sink_desc": None,
        "languages": {"java"},
        "patterns": [
            r"getConnection\s*\(\s*\)",
            r"DataSource\.getConnection\s*\(",
            r"new\s+(?:Statement|PreparedStatement|CallableStatement)\s*",
            r"new\s+Socket\s*\(",
            r"new\s+ServerSocket\s*\(",
        ],
    },
    # =================== C/C++ 特定规则 ===================
    {
        "rule_id": "DA-CPP-SQLI-002",
        "title": "C/C++ 中可能存在 SQL 注入（C SQL API 拼接输入）",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "使用参数化查询接口（sqlite3_prepare_v2 + bind、mysql_stmt_prepare、PQexecParams），不要拼接不可信输入到 SQL。",
        "source_desc": "不可信输入拼接至 SQL 语句",
        "sink_desc": "SQL 执行函数 (sqlite3_exec/mysql_query/PQexec/SQLExecDirect)",
        "languages": {"cpp"},
        "patterns": [
            r"sqlite3_exec\s*\([^,]+,\s*[^\"]\w+\+",
            r"mysql_query\s*\([^)]*\+",
            r"mysql_real_query\s*\([^)]*\+",
            r"SQLExecDirect\s*\([^)]*\+",
            r"SQLPrepare\s*\([^)]*\+",
            r"PQexec\s*\([^)]*\+",
            r"PQprepare\s*\([^)]*\+",
        ],
    },
    {
        "rule_id": "DA-CPP-XSS-002",
        "title": "C/C++ CGI 程序可能存在 XSS 风险",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "对 CGI 输出的 HTML 内容做实体编码（& < > \"），不要直接 printf HTML 模板。",
        "source_desc": "不可信输入未编码直接输出至 HTML",
        "sink_desc": "HTML 输出函数 (printf/fprintf + HTML 标签)",
        "languages": {"cpp"},
        "patterns": [
            r"printf\s*\(\s*\"<",
            r"fprintf\s*\([^,]+,\s*\"<",
            r"getenv\s*\(\s*\"QUERY_STRING",
            r"cgienv\s*\(",
        ],
    },
    {
        "rule_id": "DA-CPP-CMDI-002",
        "title": "C/C++ 中可能存在命令注入（system/popen/exec*）",
        "issue_type": "security",
        "severity": "critical",
        "suggestion": "避免将外部输入传入 system()/popen()/exec*()；使用 execve() 等参数数组接口，对输入做白名单校验。",
        "source_desc": "外部输入传入系统命令",
        "sink_desc": "命令执行函数 (system/popen/exec*/wordexp)",
        "languages": {"cpp"},
        "patterns": [
            r"\bsystem\s*\([^\",\']+\)",
            r"\bpopen\s*\([^\",\']+\)",
            r"\bexec[lv]p?e?\s*\(",
            r"\bwordexp\s*\(",
        ],
    },
    {
        "rule_id": "DA-CPP-PATH-002",
        "title": "C/C++ 中可能存在路径遍历风险（文件操作拼接外部输入）",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "对文件路径做归一化校验（realpath），禁止直接拼接外部输入到 fopen/open/access。",
        "source_desc": "用户传入的文件路径参数",
        "sink_desc": "文件系统访问函数 (fopen/open/stat/access)",
        "languages": {"cpp"},
        "patterns": [
            r"\bfopen\s*\([^\",\']+\+",
            r"\bopen\s*\([^\",\']+\+",
            r"\bstat\s*\([^\",\']+\+",
            r"\baccess\s*\([^\",\']+\+",
        ],
    },
    {
        "rule_id": "DA-CPP-CRYPTO-002",
        "title": "C/C++ 中可能使用弱加密算法",
        "issue_type": "security",
        "severity": "medium",
        "suggestion": "避免 OpenSSL 的 MD5/SHA1 等弱哈希接口，改用 SHA-256+；避免 DES/Blowfish/RC4 加密，改用 AES-256。",
        "source_desc": None,
        "sink_desc": None,
        "languages": {"cpp"},
        "patterns": [
            r"MD5_(?:Init|Update|Final)\s*\(",
            r"SHA1_(?:Init|Update|Final)\s*\(",
            r"DES(?:_set_key|_encrypt|_ecb_encrypt)\s*\(",
            r"RC4_set_key\s*\(",
            r"BLOWFISH_set_key\s*\(",
        ],
    },
    {
        "rule_id": "DA-CPP-BOF-002",
        "title": "C/C++ 可能存在缓冲区溢出（格式化字符串变体）",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "使用带边界检查的替代函数（vsprintf 改为 vsnprintf，vscanf 改为更安全的输入接口）。",
        "source_desc": "格式化字符串用户输入",
        "sink_desc": "无边界检查的格式化函数 (vsprintf/vscanf/vwscanf)",
        "languages": {"cpp"},
        "patterns": [
            r"\bvsprintf\s*\(",
            r"\bvscanf\s*\(",
            r"\bvwscanf\s*\(",
        ],
    },
    {
        "rule_id": "DA-CPP-NULL-001",
        "title": "C/C++ 可能存在空指针解引用风险",
        "issue_type": "security",
        "severity": "high",
        "suggestion": "malloc/calloc/realloc 返回后必须检查 NULL，避免直接解引用；在指针解引用前做 NULL 检查。",
        "source_desc": None,
        "sink_desc": None,
        "languages": {"cpp"},
        "patterns": [
            r"(?:malloc|calloc|realloc)\s*\([^)]*\)\s*->",
            r"(?:malloc|calloc|realloc)\s*\([^)]*\)\s*\[",
            r"\*NULL",
            r"NULL\s*->",
        ],
    },
]


def normalize_path(path: str | Path) -> str:
    return str(path).replace("\\", "/")


def is_text_file(path: str | Path) -> bool:
    path_obj = Path(path)
    if path_obj.name.lower() in SPECIAL_FILENAMES:
        return True
    return path_obj.suffix.lower() in TEXT_EXTENSIONS


def get_language_from_path(path: str | Path) -> str:
    path_obj = Path(path)
    if path_obj.name.lower() in SPECIAL_FILENAMES:
        return SPECIAL_FILENAMES[path_obj.name.lower()]
    return TEXT_EXTENSIONS.get(path_obj.suffix.lower(), "text")


def should_exclude(path: str | Path, exclude_patterns: list[str] | None = None) -> bool:
    """
    检查路径是否应该被排除。

    注意：.git/.svn/.hg 是隐藏目录（VCS 元数据），不应误杀普通目录
    如 scm/git、scm/svn 等源码目录。修复了 lstrip("./") 导致的点号丢失问题。
    """
    normalized = normalize_path(path).lstrip("./")
    # 保留原始路径用于精确匹配隐藏目录（如 .git、.svn）
    original_normalized = normalize_path(path).lstrip("/")
    normalized_with_slashes = f"/{normalized.strip('/')}/"

    for raw_pattern in DEFAULT_EXCLUDES + (exclude_patterns or []):
        # 不要 lstrip("./")，否则 ".git/**" 变成 "git/**"，会误杀源码目录 scm/git
        pattern = normalize_path(raw_pattern).strip()
        if not pattern:
            continue

        # ---- glob 模式匹配 ----
        # 用原始 pattern 做 fnmatch（保留 .git/.svn 的前导点号）
        if fnmatch.fnmatch(normalized, pattern.lstrip("./")):
            return True
        if fnmatch.fnmatch(Path(normalized).name, pattern.lstrip("./")):
            return True

        # ---- 精确目录名匹配 ----
        directory_pattern = pattern
        if directory_pattern.endswith("/**"):
            directory_pattern = directory_pattern[:-3]
        directory_pattern = directory_pattern.rstrip("/")

        if not directory_pattern:
            continue

        # 隐藏目录（如 .git、.svn、.hg）必须精确匹配带点号的名字
        # 只在路径中出现 "/.git/" "/.svn/" "/.hg/" 时排除
        if directory_pattern.startswith("."):
            if f"/{directory_pattern}/" in f"/{original_normalized.strip('/')}/":
                return True
        else:
            # 普通目录名（如 node_modules、build、target）匹配无点号路径
            if f"/{directory_pattern}/" in normalized_with_slashes:
                return True

    return False


def extract_code_snippet(file_path: str | Path, line_number: int, context: int = 2) -> str:
    try:
        lines = Path(file_path).read_text(errors="ignore").splitlines()
    except OSError:
        return ""

    if not lines:
        return ""

    start = max(0, line_number - 1 - context)
    end = min(len(lines), line_number + context)
    return "\n".join(lines[start:end])


def collect_source_files(
    workspace_dir: str | Path,
    exclude_patterns: list[str] | None = None,
    target_files: list[str] | None = None,
    max_file_size: int | None = None,
) -> list[dict[str, Any]]:
    workspace = Path(workspace_dir)
    target_set = {normalize_path(item) for item in (target_files or [])}
    max_size = max_file_size if max_file_size is not None else settings.MAX_FILE_SIZE_BYTES
    files = []

    def append_if_supported(file_path: Path, relative_path: str) -> None:
        if should_exclude(relative_path, exclude_patterns):
            return
        if target_set and relative_path not in target_set:
            return
        if not is_text_file(file_path):
            return

        try:
            stat = file_path.stat()
        except OSError:
            return
        if stat.st_size > max_size:
            return

        # 计算行数
        line_count = 0
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                for _ in f:
                    line_count += 1
        except (OSError, UnicodeDecodeError):
            line_count = 0

        files.append(
            {
                "path": relative_path,
                "absolute_path": str(file_path),
                "language": get_language_from_path(file_path),
                "size": stat.st_size,
                "line_count": line_count,
            }
        )

    if target_set:
        for relative_path in sorted(target_set):
            if Path(relative_path).is_absolute() or ".." in Path(relative_path).parts:
                continue
            append_if_supported(workspace / relative_path, relative_path)
        return sorted(files, key=lambda item: item["path"])

    for root, dirnames, filenames in os.walk(workspace):
        root_path = Path(root)
        relative_root = "" if root_path == workspace else normalize_path(root_path.relative_to(workspace))
        dirnames[:] = [
            dirname
            for dirname in dirnames
            if not should_exclude(
                f"{relative_root}/{dirname}" if relative_root else dirname,
                exclude_patterns,
            )
        ]

        for filename in filenames:
            file_path = root_path / filename
            relative_path = normalize_path(file_path.relative_to(workspace))
            append_if_supported(file_path, relative_path)

    return sorted(files, key=lambda item: item["path"])


def run_semgrep_scan(
    workspace_dir: str | Path,
    source_files: list[dict[str, Any]],
    exclude_patterns: list[str] | None = None,
    timeout_seconds: int = 120,
    rules_file: str | Path | None = None,
) -> list[dict[str, Any]]:
    # 解析 semgrep 路径：优先 PATH；找不到则回退到 venv 中的 entry point。
    # 容器里 Dockerfile 没把 /app/.venv/bin 加到 PATH，但 semgrep 装在那里——
    # 不显式 fallback 的话 shutil.which 返回 None，调用方静默拿到 0 个 finding。
    # 注意：quick_scan.py 位于 /app/app/services/quick_scan.py，
    #   parents[0]=services, [1]=app, [2]=/app (项目根)。
    semgrep_bin = shutil.which("semgrep") or str(
        Path(__file__).resolve().parents[2] / ".venv" / "bin" / "semgrep"
    )
    if not Path(semgrep_bin).exists():
        return []

    if rules_file is not None:
        rules_path = Path(rules_file)
    else:
        rules_path = Path(__file__).resolve().parents[3] / "rules" / "semgrep" / "deepaudit-rules.yml"
    if not rules_path.exists():
        return []

    workspace = Path(workspace_dir)
    source_set = {item["path"] for item in source_files}
    command = [
        semgrep_bin,
        "scan",
        "--json",
        "--quiet",
        "--config",
        str(rules_path),
    ]

    for pattern in DEFAULT_EXCLUDES + (exclude_patterns or []):
        command.extend(["--exclude", pattern])

    if 0 < len(source_files) <= 200:
        command.extend(str(Path(item["absolute_path"])) for item in source_files)
    else:
        command.append(str(workspace))

    # 清掉 HTTP_PROXY 等代理变量再调 semgrep——OCaml 实现的 semgrep 用
    # cohttp 解析这些 URL，遇到非空值就会以 "No host was provided in URI ."
    # 崩溃（看似返回非零静默退出，调用方拿到 0 finding）。本机 semgrep 完全
    # 离线扫规则，不需要代理。
    import os as _os
    proxy_free_env = {
        k: v for k, v in _os.environ.items()
        if k.upper() not in {"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"}
    }
    proxy_free_env["NO_PROXY"] = "*"

    try:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
            timeout=timeout_seconds,
            env=proxy_free_env,
        )
    except subprocess.TimeoutExpired:
        return []
    if result.returncode not in {0, 1}:
        return []

    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return []

    findings = []
    for item in payload.get("results", []):
        relative_path = normalize_path(item.get("path", ""))
        item_path = Path(relative_path)
        if item_path.is_absolute():
            try:
                relative_path = normalize_path(item_path.relative_to(workspace))
            except ValueError:
                continue
        if relative_path not in source_set:
            continue
        line_number = int(item.get("start", {}).get("line", 1))
        extra = item.get("extra", {})
        severity = (extra.get("severity") or "WARNING").lower().replace("error", "high").replace("warning", "medium").replace("info", "low")
        code_snippet = extra.get("lines") or extract_code_snippet(Path(workspace_dir) / relative_path, line_number)
        rule_id = item.get("check_id", "semgrep")

        # ── 提取数据流路径 ──
        source = None
        sink = None
        dataflow_path = None

        dataflow_trace = extra.get("dataflow_trace")
        if dataflow_trace:
            # Semgrep Pro taint-tracking 结果
            reaching_steps = dataflow_trace.get("taint_source", [])
            sink_node = dataflow_trace.get("sink", {})
            if reaching_steps:
                first_source = reaching_steps[0]
                source = first_source.get("content", "不可信外部输入")
            if sink_node:
                sink = sink_node.get("content", f"危险操作: {rule_id}")

            # 构建 dataflow_path 步骤列表
            steps = []
            step_num = 1
            for src_step in reaching_steps:
                steps.append({
                    "step": step_num,
                    "type": "source",
                    "file": src_step.get("file", relative_path),
                    "line": src_step.get("line", line_number),
                    "code": src_step.get("content", code_snippet or ""),
                    "label": src_step.get("content", source),
                    "operation": "input",
                })
                step_num += 1
            # Intermediate propagation steps
            for prop_step in dataflow_trace.get("intermediate", []):
                steps.append({
                    "step": step_num,
                    "type": "propagation",
                    "file": prop_step.get("file", relative_path),
                    "line": prop_step.get("line", line_number),
                    "code": prop_step.get("content", ""),
                    "label": prop_step.get("content", "数据传递"),
                    "operation": "assignment",
                })
                step_num += 1
            # Sink step
            if sink_node:
                steps.append({
                    "step": step_num,
                    "type": "sink",
                    "file": sink_node.get("file", relative_path),
                    "line": sink_node.get("line", line_number),
                    "code": sink_node.get("content", code_snippet or ""),
                    "label": sink,
                    "operation": "call",
                })
            dataflow_path = steps if steps else None

        # 无 Semgrep dataflow trace 时，为安全类 finding 生成简化路径
        if not dataflow_path and severity in ("high", "critical") and item.get("extra", {}).get("metadata", {}).get("category") in ("security", "injection", "xss", "sqli", "ssrf", "rce"):
            source = "不可信外部输入"
            sink = f"{relative_path}:{line_number}"
            dataflow_path = [
                {
                    "step": 1,
                    "type": "source",
                    "file": relative_path,
                    "line": line_number,
                    "code": code_snippet or "",
                    "label": source,
                    "operation": "input",
                },
                {
                    "step": 2,
                    "type": "sink",
                    "file": relative_path,
                    "line": line_number,
                    "code": code_snippet or "",
                    "label": f"危险操作: {rule_id}",
                    "operation": "call",
                },
            ]

        findings.append(
            {
                "tool": "semgrep",
                "rule_id": rule_id,
                "title": extra.get("message", "Semgrep 检测结果"),
                "issue_type": "security",
                "severity": severity,
                "file_path": relative_path,
                "line_number": line_number,
                "column_number": item.get("start", {}).get("col"),
                "description": extra.get("message", ""),
                "suggestion": "请结合上下文复核 Semgrep 结果并完成修复。",
                "code_snippet": code_snippet,
                "source": source,
                "sink": sink,
                "dataflow_path": dataflow_path,
            }
        )
    return findings


def _compiled_pattern_rules() -> list[dict[str, Any]]:
    compiled_rules = []
    for rule in PATTERN_RULES:
        compiled = rule.get("compiled_patterns")
        if compiled is None:
            compiled = [re.compile(pattern, re.IGNORECASE) for pattern in rule["patterns"]]
            rule["compiled_patterns"] = compiled
        compiled_rules.append({**rule, "compiled_patterns": compiled})
    return compiled_rules


def _scan_single_file_for_patterns(
    source_file: dict[str, Any],
    compiled_rules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    path = Path(source_file["absolute_path"])
    try:
        lines = path.read_text(errors="ignore").splitlines()
    except OSError:
        source_file["line_count"] = 0
        return []

    source_file["line_count"] = len(lines)
    findings = []
    seen = set()

    for index, line in enumerate(lines, start=1):
        for rule in compiled_rules:
            if source_file["language"] not in rule["languages"]:
                continue
            for pattern in rule["compiled_patterns"]:
                if pattern.search(line):
                    key = (rule["rule_id"], source_file["path"], index)
                    if key in seen:
                        continue
                    seen.add(key)
                    # 从规则元数据生成数据流路径
                    source_desc = rule.get("source_desc")
                    sink_desc = rule.get("sink_desc")
                    source = source_desc
                    sink = sink_desc
                    dataflow_path = None
                    if source_desc and sink_desc:
                        dataflow_path = [
                            {
                                "step": 1,
                                "type": "source",
                                "file": source_file["path"],
                                "line": index,
                                "code": line.strip(),
                                "label": source_desc,
                                "operation": "input",
                            },
                            {
                                "step": 2,
                                "type": "sink",
                                "file": source_file["path"],
                                "line": index,
                                "code": line.strip(),
                                "label": sink_desc,
                                "operation": "call",
                            },
                        ]
                    findings.append(
                        {
                            "tool": "pattern",
                            "rule_id": rule["rule_id"],
                            "title": rule["title"],
                            "issue_type": rule["issue_type"],
                            "severity": rule["severity"],
                            "file_path": source_file["path"],
                            "line_number": index,
                            "column_number": None,
                            "description": f"命中规则 {rule['rule_id']}，请复核该行及上下文是否构成真实风险。",
                            "suggestion": rule["suggestion"],
                            "code_snippet": "\n".join(lines[max(0, index - 3): min(len(lines), index + 2)]),
                            "source": source,
                            "sink": sink,
                            "dataflow_path": dataflow_path,
                        }
                    )
                    break
    return findings


def run_pattern_scan(source_files: list[dict[str, Any]]) -> list[dict[str, Any]]:
    findings = []
    compiled_rules = _compiled_pattern_rules()
    max_workers = min(32, (os.cpu_count() or 4) + 4, max(1, len(source_files)))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(_scan_single_file_for_patterns, source_file, compiled_rules)
            for source_file in source_files
        ]
        for future in as_completed(futures):
            findings.extend(future.result())

    return findings


def deduplicate_findings(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduplicated = []
    seen = set()
    for finding in findings:
        key = (
            finding.get("title"),
            finding.get("file_path"),
            finding.get("line_number"),
        )
        if key in seen:
            continue
        seen.add(key)
        deduplicated.append(finding)
    return deduplicated


def calculate_quality_score(total_files: int, findings_count: int) -> float:
    if total_files <= 0:
        return 100.0
    penalty = min(80.0, findings_count * 2.5)
    return max(20.0, round(100.0 - penalty, 1))
