# Python 安全审计规则集

> 数据来源：Bandit (PyCQA)、OWASP Python Security Project、Semgrep Python Rules、CERT Python 编码标准、Flask/Django/FastAPI 安全最佳实践

---

## 一、输入与注入类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| PY-INJ-001 | SQL注入 - 拼接不可信输入 | Critical | CWE-89 | cursor.execute() 使用字符串拼接/f-string/format构造SQL；raw SQL而非ORM安全接口 |
| PY-INJ-002 | 命令注入 - os.system/subprocess | Critical | CWE-78 | os.system()/subprocess.Popen(shell=True)/os.popen()/subprocess.call(shell=True)拼接输入 |
| PY-INJ-003 | 代码注入 - eval/exec | Critical | CWE-94 | eval()/exec()/compile()传入用户可控内容；input()在Python2中等价于eval() |
| PY-INJ-004 | NoSQL注入 - MongoDB查询拼接 | Critical | CWE-943 | collection.find()中使用$where拼接JS表达式；直接传入用户可控dict作为查询条件 |
| PY-INJ-005 | 模板注入 - Jinja2 SSTI | Critical | CWE-94 | render_template_string()使用f-string/拼接；Flask中直接渲染用户输入 |
| PY-INJ-006 | LDAP注入 | High | CWE-90 | ldap.search()拼接filter字符串；LDAP特殊字符未转义 |
| PY-INJ-007 | XPath注入 | High | CWE-643 | lxml.xpath()拼接表达式；XPath特殊字符未转义 |
| PY-INJ-008 | 格式化字符串漏洞 | Critical | CWE-134 | 用户输入直接作为format字符串而非参数 |
| PY-INJ-009 | 日志注入 | Medium | CWE-117 | logging模块写入未过滤CRLF的用户输入 |

---

## 二、反序列化类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| PY-DESER-001 | pickle反序列化不可信数据 | Critical | CWE-502 | pickle.loads()/pickle.load()反序列化网络/文件输入；可执行任意代码 |
| PY-DESER-002 | yaml.load无SafeLoader | Critical | CWE-502 | yaml.load()而非yaml.safe_load()；允许任意Python对象创建 |
| PY-DESER-003 | marshal反序列化 | High | CWE-502 | marshal.loads()/marshal.load()反序列化不可信数据 |
| PY-DESER-004 | shelve模块不安全使用 | Medium | CWE-502 | shelve.open()创建的数据库文件权限过开放 |

---

## 三、加密与随机数类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| PY-CRYP-001 | 弱哈希算法MD5/SHA1用于安全场景 | High | CWE-328 | hashlib.md5()/sha1()用于密码/签名/完整性验证而非非安全用途 |
| PY-CRYP-002 | 不安全的随机数 | High | CWE-330 | random模块而非secrets模块用于生成token/密码/会话ID |
| PY-CRYP-003 | 硬编码密钥/密码 | Critical | CWE-798/321 | SECRET_KEY/password/api_key硬编码在源码中；应使用环境变量 |
| PY-CRYP-004 | SSL证书验证禁用 | Critical | CWE-295 | requests.get(url, verify=False)；urllib禁用证书验证 |
| PY-CRYP-005 | 弱加密算法 | High | CWE-327 | DES/RC4/Blowfish加密或ECB模式使用 |
| PY-CRYP-006 | hashlib.new()可实例化弱算法 | Medium | CWE-327 | hashlib.new('md5')间接调用弱哈希 |

---

## 四、认证与会话类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| PY-AUTH-001 | Flask debug=True在生产环境 | High | CWE-489 | app.run(debug=True)/DEBUG=True配置在生产环境 |
| PY-AUTH-002 | 硬编码密码字符串 | Critical | CWE-259 | password="xxx"字符串/函数默认参数/dict()中的密码 |
| PY-AUTH-003 | 会话固定 - 登录后未regenerate | High | CWE-384 | 登录成功后未重新生成session ID |
| PY-AUTH-004 | 弱密码策略缺失 | High | CWE-521 | 注册/修改密码时无复杂度检查 |
| PY-AUTH-005 | 暴力破解防护缺失 | High | CWE-307 | 登录接口无速率限制/失败锁定 |
| PY-AUTH-006 | JWT算法混淆 | Critical | CWE-327 | JWT验证未指定算法或接受alg:none |

---

## 五、文件与路径类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| PY-FILE-001 | 路径遍历 - os.path.join拼接 | High | CWE-22 | os.path.join(base, input)未做归一化；open(base+input) |
| PY-FILE-002 | 不安全的临时文件 | Medium | CWE-377 | tempfile.mktemp()而非mkstemp()/NamedTemporaryFile() |
| PY-FILE-003 | 文件权限过于开放 | Medium | CWE-732 | os.chmod()设置0777/0666权限 |
| PY-FILE-004 | Zip Slip解压路径遍历 | High | CWE-22 | zipfile/tarfile解压未验证成员路径在预期目录内 |
| PY-FILE-005 | 文件上传缺少限制 | High | CWE-434 | 上传文件未校验类型/大小/扩展名白名单 |

---

## 六、XML与网络类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| PY-XML-001 | XXE - xml解析未禁用外部实体 | Critical | CWE-611 | xml.etree.ElementTree/lxml/minidom/sax解析未禁用外部实体 |
| PY-XML-002 | 不安全FTP/Telnet协议 | Medium | CWE-319 | ftplib/telnetlib使用不安全明文协议 |
| PY-NET-001 | 绑定所有网络接口 | Medium | CWE-285 | socket.bind(('0.0.0.0', port))暴露服务到所有接口 |
| PY-NET-002 | SSH无主机密钥验证 | High | CWE-295 | paramiko连接设置MissingHostKeyPolicy/AutoAddPolicy |
| PY-NET-001 | SSRF - 动态URL请求 | High | CWE-918 | requests/urllib/httpx使用用户可控URL |

---

## 七、Web框架专项（Flask）

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| FLASK-001 | debug=True在生产环境 | High | CWE-489 | Flask app.run(debug=True)； Werkzeug debugger暴露 |
| FLASK-002 | SECRET_KEY缺失或硬编码 | Critical | CWE-798 | app.config['SECRET_KEY']缺失/硬编码/为空 |
| FLASK-003 | CSRF保护缺失 | High | CWE-352 | 无Flask-WTF CSRF保护；POST请求未验证token |
| FLASK-004 | Jinja2自动转义关闭 | High | CWE-79 | autoescape=False；|safe过滤器处理不可信数据 |
| FLASK-005 | send_file路径不安全 | Medium | CWE-22 | send_file使用用户可控路径 |
| FLASK-006 | Session cookie不安全配置 | Medium | CWE-614 | SESSION_COOKIE_SECURE/HTTPONLY未设置 |
| FLASK-007 | 安全响应头缺失 | Medium | CWE-1021 | 未使用Flask-Talisman设置CSP/HSTS/X-Frame-Options |
| FLASK-008 | Flask-RESTful无认证 | High | CWE-284 | API端点无认证装饰器 |

---

## 八、Web框架专项（Django）

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| DJANGO-001 | DEBUG=True在生产环境 | High | CWE-489 | settings.DEBUG=True在生产部署 |
| DJANGO-002 | ALLOWED_HOSTS=['*'] | High | CWE-942 | 允许任意Host头导致Host头注入 |
| DJANGO-003 | CSRF中间件缺失 | High | CWE-352 | MIDDLEWARE中缺少django.middleware.csrf.CsrfViewMiddleware |
| DJANGO-004 | @csrf_exempt滥用 | High | CWE-352 | 不必要的@csrf_exempt装饰器 |
| DJANGO-005 | mark_safe处理不可信输入 | High | CWE-79 | mark_safe()标记不可信HTML为安全 |
| DJANGO-006 | extra()/RawSQL使用 | High | CWE-89 | Model.objects.extra()/RawSQL()拼接SQL |
| DJANGO-007 | SECRET_KEY硬编码 | Critical | CWE-798 | SECRET_KEY硬编码在settings.py而非环境变量 |
| DJANGO-008 | 安全配置缺失 | High | CWE-1021 | SECURE_SSL_REDIRECT/SECURE_HSTS_SECONDS/SESSION_COOKIE_SECURE未设置 |
| DJANGO-009 | FileExtensionValidator缺失 | Medium | CWE-434 | 文件上传未使用FileExtensionValidator白名单 |
| DJANGO-010 | 密码验证器缺失 | High | CWE-521 | AUTH_PASSWORD_VALIDATORS列表为空或过弱 |

---

## 九、Web框架专项（FastAPI）

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| FASTAPI-001 | CORS配置allow_origins=["*"] | High | CWE-942 | CORSMiddleware允许所有来源+allow_credentials |
| FASTAPI-002 | Pydantic未用strict模式 | Medium | CWE-20 | 数值字段未设strict=True可能导致类型混淆 |
| FASTAPI-003 | Swagger文档在生产暴露 | Medium | CWE-497 | docs_url/redoc_url未在生产设为None |
| FASTAPI-004 | 依赖注入未做认证 | High | CWE-284 | Depends()未包含auth依赖 |
| FASTAPI-005 | 无速率限制 | High | CWE-770 | 未使用slowapi等限流中间件 |
| FASTAPI-006 | 请求体大小无限制 | Medium | CWE-400 | 未配置max request body size |

---

## 十、依赖与供应链类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| PY-DEP-001 | 已知漏洞依赖 | High | CWE-1035 | pip-audit/safety检测到已知CVE的依赖包 |
| PY-DEP-002 | pycrypto使用（已废弃） | High | CWE-327 | import pycrypto而非pycryptodome |
| PY-DEP-003 | 依赖版本范围过宽 | Medium | CWE-1035 | requirements中使用>=而非固定版本 |
| PY-DEP-004 | 私有包源未验证 | Medium | CWE-494 | pip install从不可信源安装包 |

---

**参考来源：**
- [Bandit 官方文档](https://bandit.readthedocs.io/en/latest/plugins/index.html)
- [OWASP Python Security Project](https://owasp.org/www-project-python-security/)
- [Semgrep Python Rules](https://semgrep.dev/p/python)
- [Flask Security Best Practices](https://flask.palletsprojects.com/en/latest/security/)
- [Django Security](https://docs.djangoproject.com/en/latest/topics/security/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)