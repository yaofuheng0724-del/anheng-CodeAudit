-- 查找名称包含"质量问题"的规则
SELECT rule_code, name, category
FROM audit_rules
WHERE name LIKE '%质量问题%';

-- 更新这些规则的类别为 quality
UPDATE audit_rules
SET category = 'quality'
WHERE name LIKE '%质量问题%';

-- 验证更新结果
SELECT rule_code, name, category
FROM audit_rules
WHERE name LIKE '%质量问题%';
