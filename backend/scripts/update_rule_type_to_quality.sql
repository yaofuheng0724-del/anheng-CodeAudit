-- 将通用规则集的 rule_type 修改为 quality

-- 查看当前状态
SELECT name, rule_type
FROM audit_rule_sets
WHERE name LIKE '通用规则集%'
ORDER BY name;

-- 执行更新
UPDATE audit_rule_sets
SET rule_type = 'quality'
WHERE name LIKE '通用规则集%';

-- 验证更新结果
SELECT name, rule_type
FROM audit_rule_sets
WHERE name LIKE '通用规则集%'
ORDER BY name;
