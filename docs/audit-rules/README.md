# 代码安全审计规则集索引

> DeepAudit 项目文档 - 规则参考手册

---

## 规则文件列表

| 文件 | 规则数 | 覆盖领域 | 主要数据来源 |
|------|--------|---------|-------------|
| [python-security-rules.md](python-security-rules.md) | ~70 | Python/Flask/Django/FastAPI安全 | Bandit、OWASP Python、Semgrep |
| [java-spring-security-rules.md](java-spring-security-rules.md) | ~60 | Java/Spring安全 | FindSecBugs、Spring Security、CERT Java |
| [javascript-security-rules.md](javascript-security-rules.md) | ~60 | JS/TS/Node/React/Vue/Angular安全 | ESLint Security、OWASP Node.js、npm |
| [go-cpp-rust-security-rules.md](go-cpp-rust-security-rules.md) | ~70 | Go/C/C++/Rust安全 | GoSec、CERT C/C++、Rust安全编码 |
| [api-security-rules.md](api-security-rules.md) | ~50 | REST/GraphQL/WebSocket/微服务安全 | OWASP API Security Top 10、ASVS V13 |
| [cloud-infra-security-rules.md](cloud-infra-security-rules.md) | ~70 | Docker/K8s/Terraform/AWS/数据库安全 | CIS Benchmark、Checkov、Trivy |
| [owasp-asvs-mapping-rules.md](owasp-asvs-mapping-rules.md) | ~50 | OWASP ASVS 4.0验证要求映射 | OWASP ASVS、CWE-1003 |

**规则总数：约430条**

---

## 规则编号体系

各文件使用独立编号前缀：

| 前缀 | 领域 | 示例 |
|------|------|------|
| PY- | Python通用 | PY-INJ-001 |
| FLASK- | Flask框架 | FLASK-001 |
| DJANGO- | Django框架 | DJANGO-001 |
| FASTAPI- | FastAPI框架 | FASTAPI-001 |
| JAV- | Java通用 | JAV-INJ-001 |
| SPRING- | Spring框架 | SPRING-001 |
| JS- | JavaScript通用 | JS-INJ-001 |
| NODE- | Node.js/Express | NODE-001 |
| REACT- | React框架 | REACT-001 |
| TS- | TypeScript专项 | TS-001 |
| C- | C/C++ | C-BOF-001 |
| GO- | Go语言 | GO-CONC-001 |
| RS- | Rust语言 | RS-001 |
| API- | API通用 | API-AUTH-001 |
| REST- | REST API | REST-001 |
| GQL- | GraphQL | GQL-001 |
| WS- | WebSocket | WS-001 |
| MS- | 微服务 | MS-001 |
| DCK- | Docker | DCK-001 |
| K8S- | Kubernetes | K8S-001 |
| IAC- | Terraform/IaC | IAC-001 |
| AWS- | AWS | AWS-001 |
| DB- | 数据库 | DB-001 |
| CICD- | CI/CD | CICD-001 |

---

## 与系统默认规则集的关系

这些MD文件作为**规则参考手册**，供开发者和安全审计人员查阅。

系统中已实现的 **综合安全审计规则集（68条）** 是从这些文档中提取的核心规则，
以LLM可消费的`custom_prompt`格式存储在数据库中（`backend/app/services/init_templates.py`）。

如需将更多规则导入系统，可：
1. 在前端"规则管理-静态规则"页面手动添加
2. 修改`SYSTEM_RULE_SETS`种子数据后重建部署
3. 通过导入功能(JSON)批量添加

---

## 数据来源完整列表

| 来源 | URL | 类型 |
|------|-----|------|
| CWE/SANS Top 25 | https://cwe.mitre.org/top25/ | 漏洞分类标准 |
| OWASP ASVS 4.0 | https://owasp.org/www-project-application-security-verification-standard/ | 验证标准 |
| OWASP API Security Top 10 | https://owasp.org/API-Security/ | API安全标准 |
| FindSecBugs | https://find-sec-bugs.github.io/bugs.htm | Java检测模式 |
| Bandit | https://bandit.readthedocs.io/en/latest/plugins/ | Python检测模式 |
| GoSec | https://github.com/securego/gosec | Go检测模式 |
| CERT C/C++ Secure Coding | https://wiki.sei.cmu.edu/confluence/display/c/ | 编码标准 |
| CIS Docker Benchmark | https://www.cisecurity.org/benchmark/docker | 配置标准 |
| CIS Kubernetes Benchmark | https://www.cisecurity.org/benchmark/kubernetes | 配置标准 |
| Checkov | https://www.checkov.io/ | IaC扫描 |
| Trivy | https://trivy.dev/ | 云原生扫描 |
| Semgrep Registry | https://semgrep.dev/registry | 跨语言规则 |
| NIST SARD/Juliet | https://samate.nist.gov/SARD/ | 测试套件 |
| OpenCRE | https://owasp.org/www-project-opencre/ | 标准映射 |