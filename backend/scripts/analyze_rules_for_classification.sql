-- 查看所有批量规则的内容，用于分类
SELECT rule_code, name, category
FROM audit_rules
WHERE rule_code LIKE 'BATCH%'
ORDER BY rule_code
LIMIT 50;
