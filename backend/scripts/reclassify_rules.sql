-- 重新分类规则，确保更准确

-- 先重置所有为security，然后再设置quality和performance
UPDATE audit_rules SET category = 'security' WHERE rule_code LIKE 'BATCH%';

-- 明确的质量规则关键词（不包含安全内容的）
UPDATE audit_rules
SET category = 'quality'
WHERE rule_code LIKE 'BATCH%'
AND (
    name LIKE '%质量问题%' OR
    name LIKE '%代码质量%' OR
    name LIKE '%命名规范%' OR
    name LIKE '%注释质量%' OR
    name LIKE '%代码格式%' OR
    name LIKE '%可读性%' OR
    name LIKE '%可维护性%' OR
    name LIKE '%可测试性%' OR
    name LIKE '%代码复用%' OR
    name LIKE '%测试覆盖%' OR
    name LIKE '%可扩展性%' OR
    name LIKE '%可部署性%' OR
    name LIKE '%可观测性%' OR
    name LIKE '%未使用的导入%' OR
    name LIKE '%硬编码的IP地址%'
);

-- 明确的性能规则关键词
UPDATE audit_rules
SET category = 'performance'
WHERE rule_code LIKE 'BATCH%'
AND (
    name LIKE '%性能问题%' OR
    name LIKE '%性能测试%' OR
    name LIKE '%负载测试%' OR
    name LIKE '%压力测试%' OR
    name LIKE '%资源限制%' OR
    name LIKE '%资源控制%'
);

-- 验证最终分类结果
SELECT category, COUNT(*) as count
FROM audit_rules
WHERE rule_code LIKE 'BATCH%'
GROUP BY category
ORDER BY category;

-- 查看各类别的样本规则
SELECT '漏洞规则样本' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'security' LIMIT 15;
SELECT '质量规则样本' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'quality' LIMIT 15;
SELECT '性能规则样本' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'performance' LIMIT 15;
