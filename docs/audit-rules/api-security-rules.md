# API 安全审计规则集

> 数据来源：OWASP API Security Top 10 2023、OWASP ASVS V13、ZAP API Audit、Postman Security、API Scorecard

---

## 一、API认证与授权

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| API-AUTH-001 | API无认证 | Critical | CWE-306 | API端点无认证即可访问 |
| API-AUTH-002 | API Key在URL中传递 | High | CWE-598 | ?api_key=xxx在URL参数中暴露密钥 |
| API-AUTH-003 | Bearer Token无过期 | High | CWE-613 | JWT/Token无exp声明或过期时间过长 |
| API-AUTH-004 | Token未做权限范围校验 | High | CWE-285 | Token有scope但服务端未验证scope |
| API-AUTH-005 | 缺少Token撤销机制 | Medium | CWE-613 | 无Token黑名单/撤销端点 |
| API-AUTH-006 | OAuth2 Client Secret暴露 | Critical | CWE-798 | 前端/移动端暴露client_secret |
| API-AUTH-007 | OAuth2 State参数缺失 | High | CWE-352 | OAuth授权流程未验证state参数 |
| API-AUTH-008 | Refresh Token无轮换 | High | CWE-613 | Refresh token不轮换可无限使用 |

---

## 二、API输入与注入

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| API-INJ-001 | 缺少输入验证 | High | CWE-20 | API请求体/参数无类型/长度/格式验证 |
| API-INJ-002 | Mass Assignment | High | CWE-915 | API绑定整个对象而非白名单字段 |
| API-INJ-003 | 批量操作滥用 | Medium | CWE-770 | 批量API端点无数量限制 |
| API-INJ-004 | GraphQL查询深度/复杂度无限制 | High | CWE-770 | GraphQL未限制query depth/complexity |
| API-INJ-005 | GraphQL Introspection暴露 | Medium | CWE-497 | 生产环境暴露GraphQL schema |

---

## 三、API访问控制

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| API-AC-001 | BOLA/IDOR - 对象级授权缺失 | Critical | CWE-639 | /api/users/123可访问任意用户数据 |
| API-AC-002 | BFLA - 功能级授权缺失 | Critical | CWE-285 | 普通用户可调用管理员API |
| API-AC-003 | 水平越权 | Critical | CWE-639 | 用户A可修改/删除用户B的资源 |
| API-AC-004 | 垂直越权 | Critical | CWE-269 | 低权限角色可调用高权限API |
| API-AC-005 | 版本化API旧版本暴露 | Medium | CWE-284 | v1版本API仍可访问含已知漏洞 |

---

## 四、API数据保护

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| API-DATA-001 | 敏感数据过度暴露 | High | CWE-200 | API返回完整用户对象含密码/内部ID |
| API-DATA-002 | 响应中缺少数据脱敏 | High | CWE-359 | 手机号/身份证/银行卡号未脱敏 |
| API-DATA-003 | 错误信息泄露内部细节 | Medium | CWE-209 | 500错误返回数据库错误/堆栈/SQL |
| API-DATA-004 | 分页参数未限制 | Medium | CWE-400 | 列表API无page_size上限可一次返回全量数据 |
| API-DATA-005 | HTTP明文传输 | High | CWE-319 | API使用HTTP而非HTTPS |

---

## 五、API速率与可用性

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| API-RATE-001 | 全局速率限制缺失 | High | CWE-770 | API无全局请求频率限制 |
| API-RATE-002 | 敏感操作无独立限流 | High | CWE-307 | 登录/注册/密码重置无独立速率限制 |
| API-RATE-003 | 无并发限制 | Medium | CWE-400 | 同一账户可无限并发请求 |
| API-RATE-004 | 请求体大小无限制 | Medium | CWE-400 | POST/PUT请求体无大小上限 |

---

## 六、REST API专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| REST-001 | 不安全的HTTP方法 | High | CWE-650 | PUT/DELETE/PATCH未做权限验证 |
| REST-002 | URL中包含敏感信息 | High | CWE-598 | URL路径/查询参数含token/password |
| REST-003 | 缺少Content-Type验证 | Medium | CWE-434 | 未验证Content-Type导致解析异常 |
| REST-004 | CORS预检请求配置错误 | High | CWE-942 | OPTIONS预检响应过于宽松 |
| REST-005 | 响应头缺失安全配置 | Medium | CWE-1021 | 缺少X-Content-Type-Options/CSP/X-Frame-Options |

---

## 七、GraphQL专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| GQL-001 | 查询深度无限制 | High | CWE-770 | 嵌套查询深度无限制导致DoS |
| GQL-002 | 查询复杂度无限制 | High | CWE-770 | 复杂查询消耗大量资源 |
| GQL-003 | 批量查询滥用 | Medium | CWE-770 | 单次请求发送大量查询 |
| GQL-004 | Mutation无认证 | Critical | CWE-306 | 数据修改操作无认证 |
| GQL-005 | 字段级授权缺失 | High | CWE-285 | 用户可查询无权访问的字段 |
| GQL-006 | Introspection生产暴露 | Medium | CWE-497 | 生产环境允许schema introspection |
| GQL-007 | 错误信息泄露schema | Medium | CWE-209 | GraphQL错误返回内部类型信息 |

---

## 八、WebSocket专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| WS-001 | WebSocket无认证 | Critical | CWE-306 | ws://连接无需认证 |
| WS-002 | 跨域WebSocket劫持 | High | CWE-346 | WebSocket未验证Origin头 |
| WS-003 | 消息大小无限制 | Medium | CWE-400 | WebSocket消息无大小限制 |
| WS-004 | 消息速率无限制 | Medium | CWE-770 | WebSocket消息无频率限制 |

---

## 九、微服务专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| MS-001 | 服务间通信无认证 | Critical | CWE-306 | 微服务间API调用无认证/双向TLS |
| MS-002 | 服务发现未授权访问 | High | CWE-284 | 服务注册/发现端口无认证 |
| MS-003 | 配置中心未加密 | High | CWE-312 | 配置中心传输/存储未加密 |
| MS-004 | API网关认证绕过 | High | CWE-284 | 直接访问后端服务绕过网关认证 |
| MS-005 | 日志聚合泄露敏感信息 | High | CWE-532 | ELK/Splunk日志中包含密码/token |
| MS-006 | 熔断/限流配置缺失 | Medium | CWE-770 | 无circuit breaker/rate limiter导致级联故障 |

---

**参考来源：**
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/)
- [OWASP ASVS V13 - API and Web Service](https://owasp.org/www-project-application-security-verification-standard/)
- [GraphQL Security](https://graphql.org/learn/security/)
- [Postman API Security](https://www.postman.com/api-platform/api-security/)