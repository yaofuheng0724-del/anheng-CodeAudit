-- 查看漏洞规则样本
SELECT '漏洞规则' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'security' LIMIT 10;

-- 查看质量规则样本
SELECT '质量规则' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'quality' LIMIT 10;

-- 查看性能规则样本
SELECT '性能规则' as type, rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND category = 'performance' LIMIT 10;
