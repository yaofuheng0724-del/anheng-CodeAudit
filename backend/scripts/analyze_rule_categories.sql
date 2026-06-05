-- 分析每个通用规则集的规则类别分布

SELECT
    rs.name as rule_set_name,
    r.category,
    COUNT(r.id) as rule_count
FROM audit_rule_sets rs
JOIN audit_rules r ON rs.id = r.rule_set_id
WHERE rs.name LIKE '通用规则集%'
GROUP BY rs.name, r.category
ORDER BY rs.name, r.category;
