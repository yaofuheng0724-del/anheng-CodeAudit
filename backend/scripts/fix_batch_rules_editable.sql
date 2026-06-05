-- 修复批量规则集的编辑权限
-- 将所有批量规则集设置为非系统规则集，这样就可以编辑了

UPDATE audit_rule_sets
SET is_system = false
WHERE name LIKE '批量规则集%';

-- 验证修改结果
SELECT name, is_system, created_by
FROM audit_rule_sets
WHERE name LIKE '批量规则集%'
ORDER BY name;
