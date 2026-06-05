-- 根据规则名称关键词分类所有BATCH规则

-- 查看当前分类情况
SELECT category, COUNT(*) as count
FROM audit_rules
WHERE rule_code LIKE 'BATCH%'
GROUP BY category;

-- 分类为性能规则的关键词
UPDATE audit_rules
SET category = 'performance'
WHERE rule_code LIKE 'BATCH%'
AND (
    name LIKE '%性能%' OR
    name LIKE '%并发%' OR
    name LIKE '%缓存%' OR
    name LIKE '%资源%' OR
    name LIKE '%负载%' OR
    name LIKE '%压力%' OR
    name LIKE '%熔断%' OR
    name LIKE '%降级%' OR
    name LIKE '%限流%' OR
    name LIKE '%流量%' OR
    name LIKE '%竞争条件%' OR
    name LIKE '%资源释放%'
);

-- 分类为质量规则的关键词
UPDATE audit_rules
SET category = 'quality'
WHERE rule_code LIKE 'BATCH%'
AND (
    name LIKE '%质量%' OR
    name LIKE '%规范%' OR
    name LIKE '%可读性%' OR
    name LIKE '%可维护性%' OR
    name LIKE '%可测试性%' OR
    name LIKE '%可扩展性%' OR
    name LIKE '%代码复用%' OR
    name LIKE '%命名%' OR
    name LIKE '%注释%' OR
    name LIKE '%异常处理%' OR
    name LIKE '%日志记录%' OR
    name LIKE '%配置%' OR
    name LIKE '%未使用%' OR
    name LIKE '%可部署性%' OR
    name LIKE '%可观测性%' OR
    name LIKE '%代码格式%' OR
    name LIKE '%文档%' OR
    name LIKE '%测试覆盖%'
);

-- 其余的都分类为漏洞规则(security)
UPDATE audit_rules
SET category = 'security'
WHERE rule_code LIKE 'BATCH%'
AND category NOT IN ('quality', 'performance');

-- 验证最终分类结果
SELECT category, COUNT(*) as count
FROM audit_rules
WHERE rule_code LIKE 'BATCH%'
GROUP BY category
ORDER BY category;

-- 查看各类别的样本规则
SELECT '漏洞规则示例' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'security' LIMIT 10
UNION ALL
SELECT '质量规则示例' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'quality' LIMIT 10
UNION ALL
SELECT '性能规则示例' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'performance' LIMIT 10;
