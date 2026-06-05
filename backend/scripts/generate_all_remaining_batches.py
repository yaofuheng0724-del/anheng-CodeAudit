#!/usr/bin/env python3
"""
生成剩余所有批次的SQL脚本 - 第7-26批 (每批20条，共400条，总计500条)
"""

rule_templates = [
    # 安全相关模板
    ("{category} - {issue}", "检测{category}相关的{issue}问题", "security", "high", "检查代码中是否存在{category}相关的{issue}安全问题。", "修复{category}相关的{issue}问题"),
    ("{category}配置不当", "检测{category}配置不安全的代码", "security", "medium", "检查{category}的配置是否遵循安全最佳实践。", "安全配置{category}"),
    ("缺少{category}保护", "检测缺少{category}保护机制的代码", "security", "high", "检查是否缺少必要的{category}保护措施。", "添加{category}保护措施"),
    ("不安全的{category}实现", "检测{category}实现不安全的代码", "security", "critical", "检查{category}的实现是否存在安全漏洞。", "重新安全实现{category}"),
    ("{category}验证不足", "检测{category}验证不充分的代码", "security", "medium", "检查{category}的验证逻辑是否充分。", "增强{category}验证逻辑"),
    ("{category}信息泄露", "检测{category}可能泄露信息的代码", "security", "high", "检查是否可能通过{category}泄露敏感信息。", "防止通过{category}泄露信息"),

    # 质量相关模板
    ("{category}代码质量问题", "检测{category}相关的代码质量问题", "quality", "medium", "检查{category}相关的代码质量，如可维护性、可读性等。", "改进{category}代码质量"),
    ("缺少{category}错误处理", "检测{category}错误处理不当的代码", "quality", "low", "检查{category}相关操作的错误处理是否完善。", "完善{category}错误处理"),
    ("{category}性能问题", "检测{category}相关的性能问题", "quality", "medium", "检查{category}是否存在性能优化空间。", "优化{category}性能"),
    ("缺少{category}文档", "检测{category}缺少文档的代码", "quality", "low", "检查{category}是否有充分的文档说明。", "添加{category}文档"),
]

security_categories = [
    "认证", "授权", "会话管理", "输入验证", "输出编码", "加密", "密钥管理",
    "错误处理", "日志记录", "配置管理", "文件操作", "网络通信", "数据库",
    "缓存", "队列", "定时任务", "API设计", "微服务", "容器", "Kubernetes",
    "云服务", "第三方集成", "依赖管理", "补丁管理", "变更管理", "发布管理",
    "监控", "告警", "备份", "恢复", "灾难恢复", "安全测试", "渗透测试",
    "代码审计", "静态分析", "动态分析", "模糊测试", "安全评审", "威胁建模",
    "风险评估", "合规性", "隐私保护", "数据保护", "数据脱敏", "数据分类",
    "访问控制", "多因素认证", "单点登录", "OAuth", "JWT", "SAML",
    "证书管理", "PKI", "TLS", "SSL", "HTTPS", "WAF", "IPS", "IDS",
    "防火墙", "网络分段", "VPN", "远程访问", "物理安全", "环境安全",
    "供应链安全", "开源安全", "组件分析", "漏洞扫描", "补丁管理", "配置核查",
    "安全编码", "安全架构", "安全设计", "DevSecOps", "CI/CD安全",
    "Git安全", "代码库安全", "Artifact安全", "容器安全", "镜像安全",
    "运行时安全", "RASP", "SAST", "DAST", "IAST", "SCA",
]

quality_categories = [
    "代码格式", "命名规范", "注释质量", "函数设计", "类设计", "模块划分",
    "包结构", "依赖管理", "异常处理", "日志记录", "单元测试", "集成测试",
    "端到端测试", "测试覆盖", "性能测试", "压力测试", "负载测试",
    "代码复用", "可维护性", "可读性", "可扩展性", "可测试性", "可部署性",
    "可观测性", "监控", "告警", "链路追踪", "日志聚合", "指标收集",
    "配置管理", "环境管理", "部署流程", "回滚策略", "蓝绿部署", "金丝雀发布",
    "A/B测试", "特性开关", "配置热更新", "灰度发布", "流量控制",
    "限流", "熔断", "降级", "重试", "超时", "幂等性",
    "一致性", "可用性", "分区容错", "CAP理论", "BASE理论",
]

all_categories = security_categories + quality_categories

issues = [
    "实现", "设计", "配置", "验证", "保护", "检测", "响应", "恢复",
    "管理", "控制", "审核", "审计", "日志", "监控", "告警",
    "加密", "解密", "签名", "验证", "哈希", "随机数",
    "认证", "授权", "会话", "令牌", "凭证", "密钥",
    "输入", "输出", "编码", "解码", "转义", "过滤",
    "验证", "清洗", "标准化", "规范化", "限制", "约束",
    "检查", "校验", "断言", "假设", "前提", "后置",
]


def generate_rule(index, category_prefix=""):
    rule_code = f"BATCH-{index:03d}"
    template_idx = index % len(rule_templates)
    category_idx = index % len(all_categories)
    issue_idx = index % len(issues)

    template = rule_templates[template_idx]
    category = all_categories[category_idx]
    issue = issues[issue_idx]

    name = template[0].format(category=category, issue=issue)
    description = template[1].format(category=category, issue=issue)
    cat = template[2]
    severity = template[3]
    prompt = template[4].format(category=category, issue=issue)
    fix = template[5].format(category=category, issue=issue)

    return {
        "rule_code": rule_code,
        "name": name,
        "description": description,
        "category": cat,
        "severity": severity,
        "custom_prompt": prompt,
        "fix_suggestion": fix,
        "sort_order": index,
    }


def generate_sql_batch(batch_num, start_rule, end_rule):
    sql = f"""
-- ========================================
-- 第{batch_num}批 (BATCH-{start_rule:03d} ~ BATCH-{end_rule:03d})
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第{batch_num}批',
        '批量生成的第{batch_num}批20条规则',
        'all',
        'security',
        '{{"critical": 10, "high": 5, "medium": 2, "low": 1}}',
        false,
        false,
        true,
        {100 + batch_num},
        'd08fb5c6-f1c4-463a-9618-0742868fb868',
        NOW(),
        NOW()
    ) RETURNING id
)
INSERT INTO audit_rules (
    id, rule_set_id, rule_code, name, description,
    category, severity, custom_prompt, fix_suggestion,
    enabled, sort_order, created_at, updated_at
)
"""
    rule_lines = []
    for i in range(start_rule, end_rule + 1):
        rule = generate_rule(i)
        line = f"SELECT gen_random_uuid(), id, '{rule['rule_code']}', '{rule['name']}', '{rule['description']}', '{rule['category']}', '{rule['severity']}', '{rule['custom_prompt']}', '{rule['fix_suggestion']}', true, {rule['sort_order']}, NOW(), NOW() FROM new_rule_set"
        rule_lines.append(line)

    sql += "\nUNION ALL ".join(rule_lines)
    sql += ";"
    return sql


def main():
    # 生成第7批到第26批，从101到500
    all_sql = "-- 批量添加剩余规则 - 第7-26批 (BATCH-101 ~ BATCH-500)\n"
    all_sql += "-- 此脚本将添加400条规则，使总数达到500条\n\n"

    batch_num = 7
    for start_rule in range(101, 501, 20):
        end_rule = min(start_rule + 19, 500)
        batch_sql = generate_sql_batch(batch_num, start_rule, end_rule)
        all_sql += batch_sql
        all_sql += "\n\n"
        batch_num += 1

    all_sql += """
-- 查询结果
SELECT '所有批次插入完成！' AS status;
SELECT rs.name, rs.id, COUNT(r.id) AS rules_count
FROM audit_rule_sets rs
LEFT JOIN audit_rules r ON rs.id = r.rule_set_id
WHERE rs.name LIKE '批量规则集%'
GROUP BY rs.name, rs.id
ORDER BY rs.name;
"""

    with open('add_batches_7_to_26.sql', 'w', encoding='utf-8') as f:
        f.write(all_sql)

    print(f"✅ 已生成 add_batches_7_to_26.sql")
    print(f"   包含第7-26批，共20个批次，400条规则")
    print(f"   规则编号 BATCH-101 ~ BATCH-500")


if __name__ == "__main__":
    main()
