# Java Spring 安全审计规则集

> 数据来源：FindSecBugs (SpotBugs插件)、OWASP Java安全、Spring Security官方文档、CERT Java编码标准、Oracle安全编码指南

---

## 一、注入类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-INJ-001 | SQL注入 - Statement拼接 | Critical | CWE-89 | Statement.execute()/executeQuery()/executeUpdate()使用+拼接SQL |
| JAV-INJ-002 | SQL注入 - Hibernate/JPA拼接 | Critical | CWE-89 | createQuery()/createNativeQuery()/createSQLQuery()使用+拼接 |
| JAV-INJ-003 | SQL注入 - Spring JDBC拼接 | Critical | CWE-89 | JdbcTemplate使用字符串拼接而非参数化 |
| JAV-INJ-004 | SQL注入 - Android SQLite | Critical | CWE-89 | Android SQLiteDatabase.rawQuery()拼接 |
| JAV-INJ-005 | 盲注SQL注入 | High | CWE-89 | SQL查询使用IF/CASE/SLEEP等条件/延时函数推断数据 |
| JAV-INJ-006 | 命令注入 - Runtime.exec | Critical | CWE-78 | Runtime.getRuntime().exec()拼接输入；ProcessBuilder拼接参数 |
| JAV-INJ-007 | 代码注入 - ScriptEngine.eval | Critical | CWE-94 | ScriptEngine.eval()拼接不可信输入 |
| JAV-INJ-008 | LDAP注入 | High | CWE-90 | LdapContext.search()/LdapTemplate使用拼接filter字符串 |
| JAV-INJ-009 | XPath注入 | High | CWE-643 | XPath.evaluate()/XPathExpression拼接表达式 |
| JAV-INJ-010 | SpEL表达式注入 | Critical | CWE-94 | SpelExpressionParser.parseExpression()拼接用户输入 |
| JAV-INJ-011 | CRLF/日志注入 | High | CWE-117/113 | Logger写入未过滤CRLF的输入；HTTP Header拼接不可信数据 |
| JAV-INJ-012 | OGNL表达式注入 | Critical | CWE-94 | Struts2 OGNL表达式注入（经典攻击面） |

---

## 二、XSS类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-XSS-001 | Servlet XSS - 直接输出 | High | CWE-79 | response.getWriter().print()/write()未编码直接输出 |
| JAV-XSS-002 | JSP表达式XSS | High | CWE-79 | <%=request.getParameter()%>直接输出参数 |
| JAV-XSS-003 | JSP out.print XSS | High | CWE-79 | out.print()/out.println()输出不可信数据 |
| JAV-XSS-004 | XSS_REQUEST_WRAPPER | Medium | CWE-79 | 自定义XSS过滤RequestWrapper实现不完整 |

---

## 三、反序列化类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-DESER-001 | ObjectInputStream反序列化 | Critical | CWE-502 | ObjectInputStream.readObject()未设ObjectInputFilter类型白名单 |
| JAV-DESER-002 | Jackson enableDefaultTyping | Critical | CWE-502 | ObjectMapper.enableDefaultTyping()/activateDefaultTyping()开启 |
| JAV-DESER-003 | @JsonTypeInfo(Id.CLASS) | Critical | CWE-502 | @JsonTypeInfo(use=Id.CLASS/Id.MINIMAL_CLASS)允许任意类反序列化 |
| JAV-DESER-004 | XStream反序列化未限制 | Critical | CWE-502 | XStream.fromXML()未配置安全框架类型白名单 |
| JAV-DESER-005 | XMLDecoder反序列化 | Critical | CWE-502 | XMLDecoder.readObject()反序列化不可信XML |
| JAV-DESER-006 | fastjson autoType开启 | Critical | CWE-502 | ParserConfig.getGlobalInstance().setAutoTypeSupport(true) |

---

## 四、XXE类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-XXE-001 | SAXParser XXE | Critical | CWE-611 | SAXParser未设置FEATURE_SECURE_PROCESSING/disallow-doctype-decl |
| JAV-XXE-002 | DocumentBuilder XXE | Critical | CWE-611 | DocumentBuilderFactory未禁用外部实体 |
| JAV-XXE-003 | XMLReader XXE | Critical | CWE-611 | XMLReader未设置disallow-doctype-decl |
| JAV-XXE-004 | XMLStreamReader XXE | Critical | CWE-611 | XMLInputFactory未设置相关安全属性 |

---

## 五、加密类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-CRYP-001 | MD5/SHA1弱哈希 | High | CWE-328 | MessageDigest.getInstance("MD5"/"SHA-1"/"SHA1")用于安全场景 |
| JAV-CRYP-002 | DES/RC4/Blowfish弱加密 | High | CWE-327 | Cipher.getInstance("DES"/"RC4"/"Blowfish")；DESKeySpec使用 |
| JAV-CRYP-003 | ECB加密模式 | High | CWE-327 | Cipher.getInstance("AES/ECB/...")使用ECB模式 |
| JAV-CRYP-004 | RSA密钥过短 | High | CWE-326 | RSA密钥<2048位 |
| JAV-CRYP-005 | RSA无填充 | High | CWE-780 | Cipher.getInstance("RSA/NONE/NoPadding") |
| JAV-CRYP-006 | 不安全的随机数 | High | CWE-330 | java.util.Random而非SecureRandom用于安全场景 |
| JAV-CRYP-007 | 硬编码密钥 | Critical | CWE-321 | SecretKeySpec/setKey中使用硬编码字符串 |
| JAV-CRYP-008 | 不安全SSLContext | High | CWE-327 | SSLContext.getInstance("SSL"/"TLSv1"/"TLSv1.1") |
| JAV-CRYP-009 | 自定义MessageDigest | High | CWE-327 | 自定义哈希算法实现而非标准算法 |
| JAV-CRYP-010 | Hex转换错误 | Medium | CWE-704 | hex编码/解码实现错误 |

---

## 六、SSL/TLS类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-SSL-001 | 自定义TrustManager接受所有证书 | Critical | CWE-295 | WEAK_TRUST_MANAGER/CUSTOM_TRUST_MANAGER覆盖checkServerTrusted() |
| JAV-SSL-002 | 弱HostnameVerifier | Critical | CWE-295 | WEAK_HOSTNAME_VERIFIER允许所有hostname |
| JAV-SSL-003 | DefaultHttpClient无TLS验证 | High | CWE-295 | DefaultHttpClient/DefaultHttpClientFactory无证书验证 |
| JAV-SSL-004 | SSL证书验证缺失 | High | CWE-295 | HttpsURLConnection未设置SSLSocketFactory/HostnameVerifier |

---

## 七、认证与权限类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-AUTH-001 | 硬编码密码 | Critical | CWE-259 | setPassword("xxx")/password字段硬编码；Spring配置明文密码 |
| JAV-AUTH-002 | 高熵值字符串疑似密钥 | Medium | CWE-798 | HIGH_ENTROPY_STRING检测高熵字符串可能是密钥/token |
| JAV-AUTH-003 | LDAP匿名绑定 | High | CWE-521 | LDAP_ANONYMOUS匿名连接 |
| JAV-AUTH-004 | JWT算法混淆攻击 | Critical | CWE-327 | JwtParser未指定算法；允许alg:none |
| JAV-AUTH-005 | 密码明文存储 | Critical | CWE-259 | NoOpPasswordEncoder/StandardPasswordEncoder弱密码编码器 |
| JAV-AUTH-006 | Session固定攻击 | High | CWE-384 | 登录后sessionManagement().sessionFixation().none() |

---

## 八、授权与访问控制类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-AC-001 | CSRF保护禁用 | High | CWE-352 | Spring Security csrf().disable()；@csrf_exempt滥用 |
| JAV-AC-002 | CSRF未限制请求映射 | High | CWE-352 | SPRING_CSRF_UNRESTRICTED_REQUEST_MAPPING |
| JAV-AC-003 | Spring端点暴露 | High | CWE-284 | SPRING_ENDPOINT/@RequestMapping无权限注解 |
| JAV-AC-004 | JAX-RS端点暴露 | High | CWE-284 | JAXRS_ENDPOINT无认证 |
| JAV-AC-005 | 信任边界违规 | High | CWE-501 | TRUST_BOUNDARY_VIOLATION外部数据无条件信任 |
| JAV-AC-006 | CORS配置过宽松 | High | CWE-942 | allowedOrigins("*")配合allowCredentials(true) |
| JAV-AC-007 | Actuator端点暴露 | High | CWE-284 | management.endpoints.web.exposure.include=* |

---

## 九、Cookie与响应头类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-COOKIE-001 | Cookie无HttpOnly | Medium | CWE-1004 | Cookie设置未包含HttpOnly标志 |
| JAV-COOKIE-002 | Cookie无Secure | Medium | CWE-614 | Cookie设置未包含Secure标志 |
| JAV-COOKIE-003 | Cookie无SameSite | Medium | CWE-1275 | Cookie未设置SameSite=Strict/Lax |
| JAV-COOKIE-004 | 持久化Cookie | Low | CWE-614 | maxAge=-1/很长过期时间的Cookie |

---

## 十、路径遍历与文件类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-PATH-001 | 路径遍历读取 | High | CWE-22 | PATH_TRAVERSAL_IN - new File(request.getParameter())读取任意文件 |
| JAV-PATH-002 | 路径遍历写入 | High | CWE-22 | PATH_TRAVERSAL_OUT - 写入任意文件路径 |
| JAV-PATH-003 | 文件系统路径遍历 | High | CWE-22 | PATH_TRAVERSAL_FILESYSTEM - FileInputStream拼接路径 |
| JAV-PATH-004 | 文件上传不安全 | High | CWE-434 | MultipartFile.transferTo(new File(原始文件名))；缺少类型/大小限制 |

---

## 十一、SSRF类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-SSRF-001 | URL对象由用户输入构造 | High | CWE-918 | new URL(request.getParameter()) |
| JAV-SSRF-002 | RestTemplate动态URL | High | CWE-918 | RestTemplate.getForObject()/postForObject()/exchange()使用动态URL |
| JAV-SSRF-003 | WebClient动态URL | High | CWE-918 | WebClient.get()/post().uri(动态URL) |
| JAV-SSRF-004 | HttpURLConnection动态URL | High | CWE-918 | HttpURLConnection连接用户可控URL |

---

## 十二、资源泄漏类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-RES-001 | 数据库连接未关闭 | Medium | CWE-404 | DataSource.getConnection()/DriverManager.getConnection()未try-with-resources |
| JAV-RES-002 | IO流未关闭 | Medium | CWE-404 | FileInputStream/FileOutputStream/Socket/ServerSocket未try-with-resources |
| JAV-RES-003 | HTTP连接未关闭 | Medium | CWE-404 | HttpURLConnection未disconnect() |

---

## 十三、信息泄露类

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| JAV-INFO-001 | 堆栈泄露 | High | CWE-209 | server.error.include-stacktrace=always |
| JAV-INFO-002 | 敏感信息写入日志 | High | CWE-532 | Logger记录密码/token/PII |
| JAV-INFO-003 | Spring Actuator信息泄露 | High | CWE-497 | /env/heapdump/trace端点暴露 |

---

## 十四、Spring专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| SPRING-001 | 任何请求都permitAll | Critical | CWE-284 | http.authorizeRequests().anyRequest().permitAll() |
| SPRING-002 | @RequestMapping无方法限制 | Medium | CWE-284 | @RequestMapping未指定method |
| SPRING-003 | Mass Assignment | High | CWE-915 | @ModelAttribute绑定所有实体字段而非白名单 |
| SPRING-004 | @RequestBody缺少@Valid | Medium | CWE-20 | @RequestBody未加@Valid/@Validated |
| SPRING-005 | Debug模式在生产 | High | CWE-489 | spring.devtools.restart.enabled在生产 |
| SPRING-006 | 不安全默认配置 | High | CWE-1188 | 默认凭证/未加固的安全配置 |

---

**参考来源：**
- [FindSecBugs Bug Patterns](https://find-sec-bugs.github.io/bugs.htm)
- [Spring Security Reference](https://docs.spring.io/spring-security/reference/)
- [OWASP Java Security](https://owasp.org/www-project-java-security/)
- [CERT Java Secure Coding](https://wiki.sei.cmu.edu/confluence/display/java/)
- [Oracle Secure Coding Guidelines](https://www.oracle.com/java/technologies/javase/seccodeguide.html)