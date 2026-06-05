-- 先全部重置为漏洞规则，再重新分类

UPDATE audit_rules SET category = 'security' WHERE rule_code LIKE 'BATCH%';

UPDATE audit_rules SET category = 'performance' WHERE rule_code LIKE 'BATCH%' AND name LIKE '%性能%';
UPDATE audit_rules SET category = 'quality' WHERE rule_code LIKE 'BATCH%' AND name LIKE '%质量%';

-- 验证分类结果
SELECT category, COUNT(*) as count
FROM audit_rules
WHERE rule_code LIKE 'BATCH%'
GROUP BY category
ORDER BY category;

-- 查看所有带"性能"的规则
SELECT rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND name LIKE '%性能%' ORDER BY rule_code;

-- 查看所有带"质量"的规则
SELECT rule_code, name FROM audit_rules WHERE rule_code LIKE 'BATCH%' AND name LIKE '%质量%' ORDER BY rule_code;
