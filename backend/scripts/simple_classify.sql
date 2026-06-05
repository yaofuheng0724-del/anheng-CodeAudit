-- 简单分类：带"性能"的是性能规则，带"质量"的是质量规则，其他都是漏洞规则

UPDATE audit_rules SET category = 'performance' WHERE rule_code LIKE 'BATCH%' AND name LIKE '%性能%';
UPDATE audit_rules SET category = 'quality' WHERE rule_code LIKE 'BATCH%' AND name LIKE '%质量%';
UPDATE audit_rules SET category = 'security' WHERE rule_code LIKE 'BATCH%' AND category NOT IN ('quality', 'performance');

-- 验证分类结果
SELECT category, COUNT(*) as count
FROM audit_rules
WHERE rule_code LIKE 'BATCH%'
GROUP BY category
ORDER BY category;

-- 查看样本
SELECT '性能规则' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'performance' LIMIT 10;
SELECT '质量规则' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'quality' LIMIT 10;
SELECT '漏洞规则' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'security' LIMIT 10;
