# Go/C/C++/Rust 安全审计规则集

> 数据来源：GoSec、CERT C/C++编码标准、Rust安全编码指南、Clang Static Analyzer、AFL++/libFuzzer、CIS Benchmarks

---

## 一、C/C++ 规则

### 1.1 缓冲区溢出

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| C-BOF-001 | gets()函数使用 | Critical | CWE-119 | gets()永远不应使用（无法限制输入长度） |
| C-BOF-002 | strcpy/strcat无边界 | Critical | CWE-119 | strcpy()/strcat()无边界检查应改用strncpy()/strncat() |
| C-BOF-003 | sprintf无边界 | Critical | CWE-119 | sprintf()应改用snprintf() |
| C-BOF-004 | vsprintf无边界 | Critical | CWE-120 | vsprintf()应改用vsnprintf() |
| C-BOF-005 | memcpy/memmove长度可控 | High | CWE-787 | memcpy()/memmove()的长度参数由外部输入控制 |
| C-BOF-006 | 数组访问越界 | Critical | CWE-129 | 数组索引未做边界检查 |
| C-BOF-007 | Off-by-one错误 | High | CWE-193 | 循环边界和缓冲区大小的差一错误 |

### 1.2 内存安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| C-MEM-001 | Use After Free | Critical | CWE-416 | free()/delete后继续使用指针访问已释放内存 |
| C-MEM-002 | Double Free | Critical | CWE-415 | 对同一内存区域两次调用free() |
| C-MEM-003 | 内存泄漏 | Medium | CWE-401 | malloc/calloc后未free，尤其在错误路径 |
| C-MEM-004 | 未初始化内存使用 | High | CWE-457 | malloc()后未初始化直接使用内存内容 |
| C-MEM-005 | malloc返回NULL未检查 | High | CWE-476 | malloc/calloc/realloc返回后未检查NULL直接使用 |
| C-MEM-006 | NULL指针解引用 | Critical | CWE-476 | 指针可能为NULL时直接解引用 |
| C-MEM-007 | 类型混淆 | High | CWE-843 | 不安全的类型转换导致内存解释错误 |
| C-MEM-008 | 结构体对齐问题 | Medium | CWE-469 | 不同平台对齐差异导致缓冲区重叠 |

### 1.3 整数安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| C-INT-001 | 整数溢出-乘法 | Critical | CWE-190 | malloc(n*sizeof(type))中n*sizeof可能溢出 |
| C-INT-002 | 整数溢出-加减法 | High | CWE-190 | 整数加减运算溢出导致逻辑错误 |
| C-INT-003 | 有符号无符号混用 | High | CWE-195 | 有符号整数被当作无符号使用导致负值变正 |
| C-INT-004 | 整数截断 | Medium | CWE-197 | 大整数类型赋值给小类型导致截断 |

### 1.4 注入类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| C-INJ-001 | system()命令注入 | Critical | CWE-78 | system()执行拼接的用户输入 |
| C-INJ-002 | popen()命令注入 | Critical | CWE-78 | popen()执行拼接的用户输入 |
| C-INJ-003 | exec*()函数族 | High | CWE-78 | execl()/execle()/execlp()/execv()/execvp()/execve()参数可控 |
| C-INJ-004 | SQL注入 - C API | Critical | CWE-89 | mysql_query()/sqlite3_exec()/PQexec()拼接SQL |
| C-INJ-005 | 格式化字符串漏洞 | Critical | CWE-134 | printf()/fprintf()/sprintf()用户输入作为format参数 |
| C-INJ-006 | CGI printf XSS | High | CWE-79 | CGI程序printf输出HTML到浏览器 |

### 1.5 路径与文件

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| C-FILE-001 | 路径遍历-fopen拼接 | High | CWE-22 | fopen()/open()/stat()使用拼接路径 |
| C-FILE-002 | TOCTOU竞态条件 | High | CWE-362 | access()检查后open()使用（中间文件可被替换） |
| C-FILE-003 | 不安全的临时文件 | Medium | CWE-377 | mktemp()/tmpnam()/tempnam()可预测文件名 |
| C-FILE-004 | 文件权限过开放 | Medium | CWE-732 | chmod()设置0777/0666权限 |

### 1.6 加密与协议

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| C-CRYP-001 | OpenSSL MD5弱哈希 | High | CWE-328 | MD5_Init()/MD5_Update()/MD5_Final()使用 |
| C-CRYP-002 | OpenSSL SHA1弱哈希 | High | CWE-328 | SHA1_Init()/SHA1_Update()使用 |
| C-CRYP-003 | DES弱加密 | High | CWE-327 | DES_set_key()/DES_ecb_encrypt()/DES_encrypt()使用 |
| C-CRYP-004 | RC4弱加密 | High | CWE-327 | RC4_set_key()使用 |
| C-CRYP-005 | Blowfish弱加密 | Medium | CWE-327 | BF_set_key()使用 |

---

## 二、Go 规则

### 2.1 并发安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| GO-CONC-001 | map并发读写 | Critical | CWE-362 | 多个goroutine读写同一map未使用sync.Mutex/sync.Map |
| GO-CONC-002 | Goroutine泄漏 | High | CWE-404 | goroutine永远阻塞在channel上无法退出 |
| GO-CONC-003 | 未缓冲channel死锁 | High | CWE-667 | goroutine相互等待未缓冲channel |
| GO-CONC-004 | context未传播取消 | Medium | CWE-404 | 未将context.Cancel传递到子goroutine |
| GO-CONC-005 | WaitGroup Add/Done不匹配 | High | CWE-404 | wg.Add()和wg.Done()调用次数不一致 |

### 2.2 内存与类型安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| GO-MEM-001 | unsafe.Pointer使用 | Critical | CWE-758 | unsafe.Pointer绕过Go类型安全系统 |
| GO-MEM-002 | slice底层数组共享 | High | CWE-125 | 两个slice共享同一底层数组，修改一个影响另一个 |
| GO-MEM-003 | interface{} nil混淆 | Medium | CWE-476 | typed nil不等于nil导致nil检查失败 |
| GO-MEM-004 | defer在循环中 | Medium | CWE-404 | defer在for循环中导致资源延迟释放 |
| GO-MEM-005 | 全局变量并发访问 | High | CWE-362 | 全局变量无锁被多个goroutine读写 |

### 2.3 注入与安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| GO-INJ-001 | SQL注入 - database/sql拼接 | Critical | CWE-89 | db.Query()/db.Exec()使用字符串拼接而非参数化 |
| GO-INJ-002 | 命令注入 - os/exec拼接 | Critical | CWE-78 | exec.Command()使用拼接参数而非参数列表 |
| GO-INJ-003 | SSRF - http.Get动态URL | High | CWE-918 | http.Get()/http.Post()使用用户可控URL |
| GO-INJ-004 | 模板注入 - html/template | Medium | CWE-79 | template.Execute()渲染不可信数据 |
| GO-SEC-001 | 硬编码凭证 | Critical | CWE-798 | 程序中硬编码密码/API密钥 |
| GO-SEC-002 | 弱随机数math/rand | High | CWE-330 | math/rand而非crypto/rand用于安全场景 |
| GO-SEC-003 | TLS配置不安全 | High | CWE-295 | InsecureSkipVerify:true禁用证书验证 |
| GO-SEC-004 | 绑定0.0.0.0 | Medium | CWE-285 | net.Listen("tcp","0.0.0.0:port")暴露到所有接口 |
| GO-SEC-005 | 文件路径遍历 | High | CWE-22 | os.Open()/filepath.Join(base,input)未做归一化 |
| GO-SEC-006 | HTTP响应未关闭Body | Medium | CWE-404 | resp.Body未defer Close()导致连接泄漏 |

---

## 三、Rust 规则

### 3.1 unsafe块审计

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| RS-001 | unsound Send/Sync实现 | Critical | CWE-366 | unsafe impl Send/Sync使非线程安全类型跨线程 |
| RS-002 | 裸指针解引用 | Critical | CWE-758 | unsafe中解引用裸指针未做边界/有效性检查 |
| RS-003 | transmute类型混淆 | Critical | CWE-843 | std::mem::transmute导致类型混淆/UB |
| RS-004 | static mut多线程访问 | Critical | CWE-362 | static mut变量被多线程无同步访问 |
| RS-005 | FFI边界数据传递 | High | CWE-78 | C FFI传递无效数据跨越边界 |
| RS-006 | unsafe函数未文档化 | Medium | CWE-758 | unsafe fn未说明安全性前提条件 |

### 3.2 常见安全陷阱

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| RS-007 | unwrap()在用户可控Option/Result | Medium | CWE-476 | user-controlled Result上使用unwrap()可能panic |
| RS-008 | RefCell双重借用 | High | CWE-362 | RefCell运行时双重borrow导致panic |
| RS-009 | mem::forget跳过析构 | High | CWE-404 | std::mem::forget()跳过Drop导致资源泄漏 |
| RS-010 | Rc循环引用内存泄漏 | Low | CWE-401 | Rc<RefCell>循环引用导致内存永不释放 |
| RS-011 | panic跨FFI边界 | Critical | CWE-758 | Rust panic穿越C FFI边界导致UB |
| RS-012 | 未处理的Result/Option | Medium | CWE-754 | 忽略Result/Option可能导致静默错误 |

### 3.3 依赖与供应链

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| RS-DEP-001 | 已知漏洞依赖 | High | CWE-1035 | cargo audit检测到已知CVE |
| RS-DEP-002 | unsafe代码统计过高 | Medium | CWE-758 | cargo geiger统计unsafe代码量过多 |
| RS-DEP-003 | 依赖版本过宽 | Medium | CWE-1035 | Cargo.toml中使用*版本范围 |

---

## 四、通用编译型语言审计清单

```
□ 1. 输入验证
    - 所有外部输入是否验证（长度/类型/范围/格式）
    - 缓冲区操作前是否做边界检查
    - 数组索引是否做范围检查

□ 2. 内存安全
    - malloc返回值是否检查NULL
    - 内存是否在所有路径（含错误路径）上释放
    - free后指针是否置NULL
    - 是否有double free
    - 是否有use-after-free

□ 3. 整数安全
    - 乘法运算是否可能溢出（malloc参数）
    - 有符号/无符号转换是否安全
    - 循环变量是否可能为负值导致问题

□ 4. 并发安全
    - 共享状态是否有同步机制
    - 是否有潜在死锁（锁顺序）
    - 是否有TOCTOU竞态条件

□ 5. 加密/密钥
    - 无硬编码密钥/密码
    - 无弱哈希/弱加密算法
    - 安全场景使用CSPRNG而非普通PRNG

□ 6. 错误处理
    - 所有错误路径是否覆盖
    - 资源是否在错误路径上释放
    - 是否有静默失败（未处理的错误）

□ 7. 命令/文件操作
    - 无system()/popen()拼接输入
    - 文件路径做归一化+白名单
    - 临时文件使用安全API
```

---

**推荐审计工具：**

| 语言 | 静态分析 | 动态分析 | 漏洞扫描 | Fuzzing |
|------|---------|---------|---------|---------|
| C/C++ | Clang SA, CPPCheck, CodeQL, Coverity | ASan, MSan, UBSan, TSan | CVE数据库 | AFL++, libFuzzer |
| Go | gosec, go vet, staticcheck | go test -race | govulncheck | go-fuzz |
| Rust | Clippy, cargo-audit | Miri(UB检测) | cargo-audit | cargo-fuzz, AFL.rs |

**参考来源：**
- [CERT C Secure Coding](https://wiki.sei.cmu.edu/confluence/display/c/)
- [CERT C++ Secure Coding](https://wiki.sei.cmu.edu/confluence/display/cplusplus/)
- [GoSec Rules](https://github.com/securego/gosec)
- [Rust Secure Coding Guidelines](https://anssi-fr.gitlab.io/rust-guide/)
- [AFL++ Fuzzing](https://aflplus.plus/)