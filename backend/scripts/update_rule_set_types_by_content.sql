-- 根据规则集内容更新 rule_type

-- 先查看每个规则集的类别分布
SELECT
    rs.name,
    r.category,
    COUNT(*) as count
FROM audit_rule_sets rs
JOIN audit_rules r ON rs.id = r.rule_set_id
WHERE rs.name LIKE '通用规则集%'
GROUP BY rs.name, r.category
ORDER BY rs.name, r.category;

-- 更新规则集类型：以安全/漏洞为主的设为 security
UPDATE audit_rule_sets SET rule_type = 'security' WHERE name IN (
    '通用规则集 - 基础安全',
    '通用规则集 - 数据安全',
    '通用规则集 - Web安全',
    '通用规则集 - API安全',
    '通用规则集 - 前端安全',
    '通用规则集 - 密码学安全',
    '通用规则集 - 输入输出安全',
    '通用规则集 - 运维安全',
    '通用规则集 - 访问控制',
    '通用规则集 - 供应链安全',
    '通用规则集 - 安全测试',
    '通用规则集 - 安全编码',
    '通用规则集 - 密钥配置',
    '通用规则集 - 漏洞管理',
    '通用规则集 - 认证安全',
    '通用规则集 - 认证协议'
);

-- 更新规则集类型：以质量为主的设为 quality
UPDATE audit_rule_sets SET rule_type = 'quality' WHERE name IN (
    '通用规则集 - 代码规范',
    '通用规则集 - 代码质量',
    '通用规则集 - 代码质量-高级',
    '通用规则集 - 可维护性',
    '通用规则集 - 配置日志'
);

-- 更新规则集类型：以性能为主的设为 performance
UPDATE audit_rule_sets SET rule_type = 'performance' WHERE name IN (
    '通用规则集 - 发布管理',
    '通用规则集 - 流量管理',
    '通用规则集 - 备份恢复',
    '通用规则集 - 灾难恢复',
    '通用规则集 - 熔断降级'
);

-- 验证更新结果
SELECT name, rule_type FROM audit_rule_sets WHERE name LIKE '通用规则集%' ORDER BY name;
