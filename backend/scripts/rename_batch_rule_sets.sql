-- 将批量规则集重命名为通用规则集
-- 保持原有的编号顺序

-- 查看当前的规则集
SELECT name, sort_order
FROM audit_rule_sets
WHERE name LIKE '批量规则集%'
ORDER BY sort_order, name;

-- 执行重命名
UPDATE audit_rule_sets
SET name = REPLACE(name, '批量规则集', '通用规则集')
WHERE name LIKE '批量规则集%';

-- 验证重命名结果
SELECT name, sort_order
FROM audit_rule_sets
WHERE name LIKE '通用规则集%'
ORDER BY sort_order, name;
