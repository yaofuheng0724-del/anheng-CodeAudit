# 云原生与基础设施安全审计规则集

> 数据来源：CIS Docker/Kubernetes Benchmarks、NSA/CISA Kubernetes Hardening Guidance、Checkov/tfsec/Trivy IaC规则、AWS Well-Architected Security Pillar、OWASP Cloud Security

---

## 一、Docker容器安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| DCK-001 | 容器以root运行 | Critical | CWE-250 | Dockerfile未设置USER非root；容器默认root |
| DCK-002 | 特权模式运行 | Critical | CWE-265 | docker run --privileged或k8s privileged:true |
| DCK-003 | 不安全的基础镜像 | High | CWE-1035 | 使用latest标签而非固定版本；未签名镜像 |
| DCK-004 | 容器内安装不必要的包 | Medium | CWE-1104 | 镜像中包含curl/wget/netcat等调试工具 |
| DCK-005 | Docker daemon暴露2375端口 | Critical | CWE-284 | Docker Remote API无TLS认证暴露 |
| DCK-006 | 环境变量中明文密钥 | Critical | CWE-798 | Dockerfile ENV/docker-compose中硬编码密码 |
| DCK-007 | 挂载宿主机敏感目录 | Critical | CWE-269 | -v /:/host挂载宿主机根目录/proc/sys |
| DCK-008 | Docker socket暴露 | Critical | CWE-265 | /var/run/docker.sock挂载到容器中 |
| DCK-009 | 未设置资源限制 | Medium | CWE-770 | 容器无CPU/memory限制可无限消耗 |
| DCK-010 | 健康检查缺失 | Low | CWE-754 | Dockerfile无HEALTHCHECK指令 |
| DCK-011 | 容器间网络未隔离 | Medium | CWE-284 | 默认bridge网络所有容器可互通 |
| DCK-012 | Docker日志驱动未配置 | Medium | CWE-778 | 无json-file/log限制导致日志占满磁盘 |

---

## 二、Kubernetes安全

### 2.1 Pod安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| K8S-001 | Pod运行特权容器 | Critical | CWE-265 | securityContext.privileged:true |
| K8S-002 | Pod未设置runAsNonRoot | High | CWE-250 | securityContext.runAsNonRoot未设为true |
| K8S-003 | Pod允许capability扩展 | High | CWE-265 | securityContext.capabilities.add包含NET_ADMIN/SYS_ADMIN |
| K8S-004 | hostNetwork/hostPID使用 | High | CWE-269 | hostNetwork:true/hostPID:true共享宿主机网络/进程 |
| K8S-005 | hostPath挂载 | Critical | CWE-269 | volumes.hostPath挂载宿主机敏感路径 |
| K8S-006 | container无资源限制 | High | CWE-770 | resources.limits/requests缺失 |
| K8S-007 | Pod Security Standard未配置 | High | CWE-265 | namespace无Pod Security Standards/Admission限制 |
| K8S-008 | 自动挂载serviceAccountToken | Medium | CWE-284 | automountServiceAccountToken:true默认挂载 |

### 2.2 RBAC与认证

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| K8S-009 | cluster-admin权限过度授予 | Critical | CWE-269 | ClusterRoleBinding授予cluster-admin给普通用户 |
| K8S-010 | ServiceAccount权限过大 | High | CWE-269 | ServiceAccount绑定过于宽泛的Role |
| K8S-011 | namespace无NetworkPolicy | Medium | CWE-284 | namespace无NetworkPolicy限制Pod间通信 |
| K8S-012 | API Server匿名访问 | Critical | CWE-306 | --anonymous-auth=true允许匿名请求 |

### 2.3 配置与密钥

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| K8S-013 | Secret明文存储 | High | CWE-312 | Secret未加密(etcd加密未启用) |
| K8S-014 | ConfigMap含敏感数据 | High | CWE-798 | ConfigMap而非Secret存储密码/密钥 |
| K8S-015 | etcd未启用TLS | Critical | CWE-319 | etcd通信未加密 |
| K8S-016 | kubelet未认证 | Critical | CWE-306 | kubelet --anonymous-auth=true |
| K8S-017 | etcd无认证 | Critical | CWE-306 | etcd --client-cert-auth=false |

### 2.4 日志与监控

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| K8S-018 | Audit Log未启用 | High | CWE-778 | --audit-log-path未配置 |
| K8S-019 | 无运行时安全监控 | Medium | CWE-754 | 未部署Falco/Tracee等运行时检测工具 |

---

## 三、Terraform/IaC安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| IAC-001 | 明文密钥在Terraform | Critical | CWE-798 | provider块中硬编码access_key/secret_key/password |
| IAC-002 | S3 Bucket公开访问 | Critical | CWE-284 | aws_s3_bucket_acl="public-read"或public-read-write |
| IAC-003 | 安全组规则过宽 | Critical | CWE-284 | ingress cidr_blocks=["0.0.0.0/0"]暴露所有端口 |
| IAC-004 | 未启用加密 | High | CWE-312 | EBS/RDS/S3未配置加密 |
| IAC-005 | 未启用版本控制 | Medium | CWE-1051 | S3 Bucket未启用versioning |
| IAC-006 | IAM策略过于宽泛 | High | CWE-269 | iam_policy Statement Action="*" Resource="*" |
| IAC-007 | VPC无流日志 | Medium | CWE-778 | aws_vpc未启用flow_log |
| IAC-008 | CloudFormation明文密钥 | Critical | CWE-798 | Resources中硬编码密码 |
| IAC-009 | 状态文件未加密存储 | High | CWE-312 | Terraform state存储在未加密后端 |
| IAC-010 | 未使用远程状态锁定 | Medium | CWE-362 | 未启用state locking导致并发冲突 |

---

## 四、AWS专项

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| AWS-001 | IAM root账户未禁用 | High | CWE-250 | root用户Access Key存在 |
| AWS-002 | S3 Bucket未启用日志 | Medium | CWE-778 | S3 Bucket无访问日志 |
| AWS-003 | RDS公开访问 | Critical | CWE-284 | RDS实例公开可访问 |
| AWS-004 | CloudTrail未启用 | High | CWE-778 | AWS账号无CloudTrail审计日志 |
| AWS-005 | 未启用MFA | High | CWE-308 | IAM用户未启用MFA |
| AWS-006 | Lambda函数公开 | Medium | CWE-284 | Lambda函数策略允许所有人调用 |
| AWS-007 | ECR镜像未扫描 | Medium | CWE-1035 | ECR未启用image scanning |
| AWS-008 | 默认VPC使用 | Low | CWE-284 | 使用默认VPC而非自定义隔离VPC |

---

## 五、数据库安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| DB-001 | PostgreSQL trust认证 | Critical | CWE-306 | pg_hba.conf使用trust认证方法 |
| DB-002 | PostgreSQL SUPERUSER滥用 | High | CWE-269 | 应用账户授予SUPERUSER权限 |
| DB-003 | PostgreSQL SSL未启用 | High | CWE-319 | 连接未强制SSL |
| DB-004 | MongoDB无认证 | Critical | CWE-306 | mongod未配置--auth/authentication |
| DB-005 | MongoDB默认端口暴露 | High | CWE-284 | 27017端口绑定0.0.0.0 |
| DB-006 | Redis无密码 | Critical | CWE-306 | Redis未配置requirepass |
| DB-007 | Redis绑定0.0.0.0 | High | CWE-284 | Redis bind 0.0.0.0暴露到公网 |
| DB-008 | Redis FLUSHALL未限制 | High | CWE-269 | FLUSHALL/FLUSHDB/CONFIG命令未rename/disable |
| DB-009 | Redis EVAL注入 | High | CWE-94 | EVAL命令拼接用户输入到Lua脚本 |
| DB-010 | 数据库默认凭证 | Critical | CWE-798 | MySQL/PostgreSQL/MongoDB使用默认密码 |
| DB-011 | 数据库日志记录敏感数据 | High | CWE-532 | 查询日志记录含密码的INSERT/UPDATE |

---

## 六、CI/CD管道安全

| 编号 | 规则名称 | 严重性 | CWE | 检测要点 |
|------|---------|--------|-----|---------|
| CICD-001 | 管道密钥明文存储 | Critical | CWE-798 | CI/CD变量中明文密码而非Vault/Secret管理 |
| CICD-002 | 依赖未做完整性验证 | High | CWE-494 | npm/pip安装未验证包完整性签名 |
| CICD-003 | 未固定构建工具版本 | Medium | CWE-1035 | Dockerfile/CI中使用latest而非固定版本 |
| CICD-004 | 管道脚本注入 | High | CWE-78 | CI脚本使用用户可控变量构造命令 |
| CICD-005 | 分支保护缺失 | Medium | CWE-284 | 主分支无保护规则(允许force push) |
| CICD-006 | 自动部署无审批 | Medium | CWE-284 | 生产部署无需人工审批 |

---

**参考来源：**
- [CIS Docker Benchmark v1.3](https://www.cisecurity.org/benchmark/docker)
- [CIS Kubernetes Benchmark v1.8](https://www.cisecurity.org/benchmark/kubernetes)
- [NSA/CISA Kubernetes Hardening Guidance](https://media.defense.gov/2022/Aug/29/2003060204/-1/-1/0/CTR_KUBERNETES_HARDENING_GUIDANCE_1.2_20220829.PDF)
- [Checkov IaC Scanner](https://www.checkov.io/)
- [Trivy Misconfiguration Scanner](https://trivy.dev/latest/docs/scanner/misconfiguration/)
- [AWS Well-Architected Security Pillar](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/)