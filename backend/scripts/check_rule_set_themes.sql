-- 查看每个规则集的前5条规则，了解主题

SELECT rs_name, string_agg(r_name, ' | ') as sample_rules
FROM (
    SELECT
        rs.name as rs_name,
        r.name as r_name,
        ROW_NUMBER() OVER (PARTITION BY rs.id ORDER BY r.sort_order) as rn
    FROM audit_rule_sets rs
    JOIN audit_rules r ON rs.id = r.rule_set_id
    WHERE rs.name LIKE '通用规则集%'
) sub
WHERE rn <= 5
GROUP BY rs_name
ORDER BY rs_name;
