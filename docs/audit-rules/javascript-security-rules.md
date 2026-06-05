# JavaScript/TypeScript/Node.js/React 安全审计规则集

> 数据来源：OWASP Node.js Security Checklist、ESLint Security Plugin、Semgrep JS Rules、React Security Best Practices、npm Security Guide

---

## 一、注入类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JS-INJ-001 | SQL注入 - 拼接不可信输入 | Critical | CWE-89 | MySQL/PostgreSQL query()使用字符串拼接构造SQL |
| JS-INJ-002 | NoSQL注入 - MongoDB | Critical | CWE-943 | MongoDB find()/update()使用$where拼接或直接传入用户dict |
| JS-INJ-003 | 命令注入 - child_process | Critical | CWE-78 | child_process.exec()/execSync()拼接用户输入(shell=True) |
| JS-INJ-004 | 代码注入 - eval/Function | Critical | CWE-94 | eval()/Function()/new Function()传入动态内容 |
| JS-INJ-005 | 原型污染 | High | CWE-1321 | Object.assign()/merge()递归合并用户输入污染Object.prototype |
| JS-INJ-006 | 模板注入 - EJS/Pug/HBS | Critical | CWE-94 | 模板引擎渲染用户输入作为模板内容而非变量 |
| JS-INJ-007 | 正则表达式DoS (ReDoS) | Medium | CWE-400 | 复杂正则表达式可能导致回溯爆炸 |
| JS-INJ-008 | SSRF - 动态URL请求 | High | CWE-918 | axios/fetch/request/http.request使用用户可控URL |
| JS-INJ-009 | XPath注入 | High | CWE-643 | xpath.evaluate()拼接表达式 |

---

## 二、XSS类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JS-XSS-001 | innerHTML直接写入 | High | CWE-79 | element.innerHTML=可控数据；document.write()写入不可信内容 |
| JS-XSS-002 | React dangerouslySetInnerHTML | High | CWE-79 | dangerouslySetInnerHTML={{__html: 可控数据}} |
| JS-XSS-003 | Vue v-html指令 | High | CWE-79 | v-html绑定可控数据 |
| JS-XSS-004 | Angular [innerHtml] | High | CWE-79 | [innerHtml]绑定可控数据 |
| JS-XSS-005 | Svelte {@html} | High | CWE-79 | {@html 可控数据} |
| JS-XSS-006 | jQuery .html() | High | CWE-79 | $(el).html(可控数据) |
| JS-XSS-007 | DOM型XSS - 不安全source | High | CWE-79 | document.URL/location.hash/document.referrer写入DOM |
| JS-XSS-008 | URL编码XSS | Medium | CWE-79 | URL参数未编码直接使用 |
| JS-XSS-009 | setTimeout/setInterval字符串 | Medium | CWE-94 | setTimeout(string)/setInterval(string)可执行代码 |

---

## 三、认证与Session类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JS-AUTH-001 | JWT无算法验证 | Critical | CWE-327 | jwt.verify()未指定算法或允许alg:none |
| JS-AUTH-002 | JWT密钥硬编码 | Critical | CWE-798 | JWT secret硬编码在源码而非环境变量 |
| JS-AUTH-003 | Cookie不安全配置 | Medium | CWE-614 | Cookie未设httpOnly/secure/SameSite |
| JS-AUTH-004 | Session固定 | High | CWE-384 | 登录后未regenerate session |
| JS-AUTH-005 | 密码存储明文或弱哈希 | Critical | CWE-259 | 使用MD5/SHA1存储密码而非bcrypt/argon2 |
| JS-AUTH-006 | OAuth state参数缺失 | High | CWE-352 | OAuth流程未生成/验证state参数 |
| JS-AUTH-007 | localStorage存JWT | Medium | CWE-922 | JWT存储在localStorage而非HttpOnly Cookie |
| JS-AUTH-008 | 暴力破解防护缺失 | High | CWE-307 | 登录接口无速率限制 |

---

## 四、加密类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JS-CRYP-001 | Math.random()用于安全场景 | High | CWE-330 | Math.random()而非crypto.randomBytes()/crypto.getRandomValues() |
| JS-CRYP-002 | MD5/SHA1弱哈希 | High | CWE-328 | crypto.createHash('md5'/'sha1')用于安全场景 |
| JS-CRYP-003 | 硬编码密钥 | Critical | CWE-321 | API_KEY/SECRET/TOKEN硬编码在源码 |
| JS-CRYP-004 | TLS证书验证禁用 | Critical | CWE-295 | rejectUnauthorized:false/NODE_TLS_REJECT_UNAUTHORIZED=0 |
| JS-CRYP-005 | 弱加密算法 | High | CWE-327 | crypto.createCipheriv('des'/'rc4')使用 |

---

## 五、Node.js/Express专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| NODE-001 | Helmet安全头缺失 | Medium | CWE-1021 | 未使用helmet()中间件设置安全响应头 |
| NODE-002 | CORS配置过宽松 | High | CWE-942 | app.use(cors({origin:'*'}))配合credentials |
| NODE-003 | 堆栈泄露到客户端 | High | CWE-209 | 生产环境返回完整错误堆栈/err.message |
| NODE-004 | express-rate-limit缺失 | High | CWE-770 | 关键路由无express-rate-limit速率限制 |
| NODE-005 | 请求体大小无限制 | Medium | CWE-400 | 未配置bodyParser limit/body-parser size上限 |
| NODE-006 | CSRF保护缺失 | High | CWE-352 | 状态变更请求无CSRF token验证 |
| NODE-007 | 不安全的redirect | Medium | CWE-601 | res.redirect(userUrl)开放重定向 |
| NODE-008 | 调试端口暴露 | High | CWE-497 | Node.js --inspect端口暴露到外部 |
| NODE-009 | path traversal | High | CWE-22 | path.join(base, userInput)未做归一化 |
| NODE-010 | 文件上传不安全 | High | CWE-434 | multer未限制文件类型/大小 |

---

## 六、React专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| REACT-001 | dangerouslySetInnerHTML | High | CWE-79 | 未用DOMPurify净化直接使用dangerouslySetInnerHTML |
| REACT-002 | href动态拼接XSS | Medium | CWE-79 | <a href={userUrl}>链接注入 |
| REACT-003 | eval/Function在React组件 | Critical | CWE-94 | 组件中使用eval()/Function() |
| REACT-004 | 状态管理中的敏感数据 | Medium | CWE-922 | Redux/Context存储密码/token在客户端 |
| REACT-005 | 未验证的PropTypes | Low | CWE-20 | 缺少PropTypes/TypeScript类型验证 |

---

## 七、TypeScript专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| TS-001 | strict模式未开启 | Medium | CWE-20 | tsconfig.json未启用strict模式 |
| TS-002 | as any绕过类型检查 | Medium | CWE-20 | 使用as any/类型断言绕过安全检查 |
| TS-003 | 缺少运行时验证 | High | CWE-20 | API边界未用zod/yup/Joi做运行时验证(仅依赖TS类型) |
| TS-004 | !非空断言滥用 | Medium | CWE-20 | 过多使用!非空断言而非null检查 |

---

## 八、依赖与供应链类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JS-DEP-001 | 已知漏洞npm包 | High | CWE-1035 | npm audit检测到已知CVE的依赖 |
| JS-DEP-002 | 依赖版本范围过宽 | Medium | CWE-1035 | package.json中使用^/~版本范围而非固定版本 |
| JS-DEP-003 | package-lock.json完整性 | Medium | CWE-494 | 未使用npm ci确保确定性安装 |
| JS-DEP-004 | 未经审查的依赖 | Medium | CWE-1357 | 安装未经审查的第三方包 |

---

## 九、数据库专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JS-DB-001 | SQL拼接 - knex/sequelize | Critical | CWE-89 | knex.raw()/sequelize.query()拼接用户输入 |
| JS-DB-002 | MongoDB注入 | Critical | CWE-943 | mongoose find()使用用户可控条件对象 |
| JS-DB-003 | Redis EVAL命令注入 | High | CWE-94 | redis.eval()拼接用户输入到Lua脚本 |

---

**参考来源：**
- [OWASP Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [ESLint Security Plugin](https://github.com/nickmalcolm/eslint-plugin-security)
- [Semgrep JavaScript Rules](https://semgrep.dev/p/javascript)
- [React Security Best Practices](https://react.dev/learn/keeping-components-pure)
- [npm Security Guide](https://docs.npmjs.com/cli/v10/commands/npm-audit)