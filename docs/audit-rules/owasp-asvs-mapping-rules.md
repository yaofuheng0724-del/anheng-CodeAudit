# OWASP ASVS 4.0 验证要求映射规则集

> 数据来源：OWASP Application Security Verification Standard 4.0、CWE-1003映射、OWASP Proactive Controls
> ASVS提供了13个章节345条分级验证要求(Level 1/2/3)，以下提取各章节核心规则映射到代码审计检测要点

---

## V1 - 架构、设计与威胁建模

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V1.1 | 安全架构文档 | 安全架构文档缺失 | Medium | CWE-1051 | 缺少安全架构设计文档/威胁建模 |
| V1.2 | 娔威胁建模 | 娔威胁建模缺失 | Medium | CWE-1188 | 未进行STRIDE/DREAD威胁建模 |
| V1.3 | 安全设计原则 | 深度防御缺失 | High | CWE-653 | 单层安全控制无纵深防御 |
| V1.5 | 安全接口设计 | 信任边界定义不清 | High | CWE-501 | 内部组件间通信无认证 |

---

## V2 - 认证验证

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V2.1 | 密码安全 | 弱密码策略 | High | CWE-521 | 最少8位+大小写+数字+特殊字符 |
| V2.2 | 通用认证安全 | 凭证硬编码 | Critical | CWE-798 | 密码/API密钥硬编码在源码 |
| V2.3 | 认证凭证 | 不安全密码存储 | Critical | CWE-259 | 明文/MD5/SHA1存储密码 |
| V2.4 | JWT/Token | JWT算法混淆 | Critical | CWE-327 | JWT验证未指定算法/接受alg:none |
| V2.5 | 速率限制 | 暴力破解防护缺失 | High | CWE-307 | 登录接口无速率限制 |
| V2.6 | 多因素认证 | MFA缺失 | Medium | CWE-308 | 高风险操作仅依赖单因素认证 |
| V2.7 | OAuth | OAuth state缺失 | High | CWE-352 | OAuth流程未验证state参数 |

---

## V3 - 会话管理

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V3.1 | 会话固定 | 登录后未regenerate session | High | CWE-384 | 登录成功后session ID不变 |
| V3.2 | Cookie安全 | Cookie缺少Secure/HttpOnly | Medium | CWE-614 | SESSION_COOKIE_SECURE/HTTPONLY未设置 |
| V3.3 | 会话超时 | 会话无过期时间 | Medium | CWE-613 | Session/Token无timeout或过长 |
| V3.4 | CSRF | CSRF保护缺失 | High | CWE-352 | POST请求未验证CSRF Token |
| V3.5 | 会话存储 | 会话数据暴露 | Medium | CWE-922 | localStorage存敏感session数据 |

---

## V4 - 访问控制

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V4.1 | 功能级访问控制 | API端点无权限校验 | High | CWE-285 | Controller/API无认证注解 |
| V4.2 | 数据级访问控制 | IDOR越权访问 | Critical | CWE-639 | 通过修改ID可访问他人资源 |
| V4.3 | 权限提升 | 水平/垂直越权 | Critical | CWE-269 | 角色参数被客户端控制 |
| V4.4 | RBAC | RBAC未实施 | Medium | CWE-862 | 缺少基于角色的细粒度权限 |
| V4.5 | CORS | CORS配置过宽松 | High | CWE-942 | allowedOrigins("*") |

---

## V5 - 输入验证与编码

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V5.1 | 输入验证 | 缺少输入验证 | High | CWE-20 | API参数无类型/长度/格式验证 |
| V5.2 | 注入防护 | SQL注入 | Critical | CWE-89 | SQL拼接不可信输入 |
| V5.2 | 注入防护 | 命令注入 | Critical | CWE-78 | OS命令拼接不可信输入 |
| V5.2 | 注入防护 | XSS | Critical | CWE-79 | HTML输出未编码 |
| V5.3 | 输出编码 | 输出编码缺失 | High | CWE-79 | 缺少上下文相关编码 |
| V5.4 | 文件处理 | 路径遍历 | High | CWE-22 | 文件路径拼接外部输入 |
| V5.5 | Mass Assignment | 对象属性批量绑定 | High | CWE-915 | API绑定整个对象而非白名单 |

---

## V6 - 加密

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V6.1 | 数据分类 | 敏感数据未标识 | Medium | CWE-200 | 未对数据做安全等级分类 |
| V6.2 | 加密算法 | 弱哈希/弱加密 | High | CWE-327/328 | MD5/SHA1/DES/RC4/ECB使用 |
| V6.3 | 随机数 | 不安全PRNG | High | CWE-330 | 非CSPRNG用于安全场景 |
| V6.4 | 密钥管理 | 密钥硬编码/无轮换 | Critical | CWE-321 | 密钥硬编码/从不轮换 |
| V6.5 | TLS | TLS配置错误 | Critical | CWE-295 | 证书验证禁用/弱协议 |
| V6.6 | 敏感数据存储 | 明文存储 | Critical | CWE-312 | 密码/PII明文存储 |

---

## V7 - 错误处理与日志

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V7.1 | 错误处理 | 堆栈泄露到客户端 | High | CWE-209 | 500错误返回完整堆栈 |
| V7.2 | 日志安全 | 日志记录敏感信息 | High | CWE-532 | 日志记录密码/token/PII |
| V7.3 | 日志注入 | CRLF注入日志 | Medium | CWE-117 | 未过滤换行符写入日志 |
| V7.4 | 监控 | 安全监控缺失 | Medium | CWE-778 | 无安全事件告警/异常监控 |

---

## V8 - 数据保护

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V8.1 | 数据脱敏 | API返回未脱敏数据 | High | CWE-359 | 手机号/身份证未脱敏 |
| V8.2 | 数据加密传输 | HTTP明文传输 | Critical | CWE-319 | 敏感数据通过HTTP传输 |
| V8.3 | 数据加密存储 | 数据库明文存储 | Critical | CWE-312 | 敏感字段无加密 |
| V8.4 | 数据完整性 | 签名验证缺失 | Medium | CWE-354 | 数据传输无完整性校验 |

---

## V9 - 通信安全

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V9.1 | TLS配置 | SSLv3/TLS1.0/1.1使用 | Critical | CWE-327 | 使用过旧的TLS协议版本 |
| V9.2 | 证书验证 | 证书验证缺失 | Critical | CWE-295 | 自定义TrustManager接受所有证书 |

---

## V10 - 恶意代码

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V10.1 | 代码完整性 | 源码完整性验证缺失 | Medium | CWE-354 | CI/CD管道未验证代码签名 |
| V10.2 | 反序列化 | 不安全反序列化 | Critical | CWE-502 | Java/Python/PHP反序列化不可信数据 |

---

## V11 - 业务逻辑

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V11.1 | 业务逻辑验证 | 业务逻辑绕过 | High | CWE-841 | 多步骤流程可被跳过 |
| V11.2 | 反自动化 | 速率限制缺失 | High | CWE-770 | 关键接口无频率控制 |
| V11.3 | 防竞态 | 竞态条件 | Medium | CWE-362 | check-then-act无原子性 |

---

## V12 - 文件与资源

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V12.1 | 文件上传 | 上传安全缺失 | High | CWE-434 | 文件上传无类型/大小/路径限制 |
| V12.2 | 文件下载 | 路径遍历 | High | CWE-22 | 文件下载路径拼接不可信输入 |
| V12.3 | Zip Slip | 解压路径遍历 | High | CWE-22 | 解压未校验成员路径 |
| V12.4 | SSRF | SSRF漏洞 | High | CWE-918 | 服务端使用用户可控URL |
| V12.5 | XXE | XXE攻击 | Critical | CWE-611 | XML解析器未禁用外部实体 |

---

## V13 - API与Web服务

| 编号 | ASVS要求 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|---------|--------|-----|---------|
| V13.1 | API认证 | API无认证 | Critical | CWE-306 | API端点无认证机制 |
| V13.2 | API授权 | IDOR越权 | Critical | CWE-639 | API对象级授权缺失 |
| V13.3 | API输入 | 输入验证缺失 | High | CWE-20 | API请求体无Pydantic/@Valid验证 |
| V13.4 | GraphQL | 查询深度/复杂度无限制 | High | CWE-770 | GraphQL无depth/complexity限制 |
| V13.5 | CORS | CORS配置错误 | High | CWE-942 | API CORS允许所有来源 |

---

**ASVS分级验证要求统计：**

| 验证级别 | Level 1 (基础) | Level 2 (标准) | Level 3 (高级) |
|---------|---------------|---------------|---------------|
| 要求数量 | 70 | 183 | 92 |
| 适用场景 | 所有应用 | 常规应用 | 高风险应用 |

**参考来源：**
- [OWASP ASVS 4.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP ASVS on GitHub](https://github.com/OWASP/ASVS)
- [CWE-1003 ASVS Mapping](https://cwe.mitre.org/data/definitions/1003.html)
- [OWASP Proactive Controls](https://owasp.org/www-project-proactive-controls/)