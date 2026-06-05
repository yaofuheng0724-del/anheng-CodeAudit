-- ============================================================
-- 统一规则分类迁移脚本
-- 分类规则：
--   规则名带有"性能"的统一归为性能规则 → category='performance'
--   规则名带有"质量"的统一归为质量规则 → category='quality'
--   其他均归为漏洞规则 → category='security'
-- 规则集 rule_type 同理
-- ============================================================

-- ============== 第一步：更新规则名称（添加性能/质量标识） ==============

-- 性能优化规则集中的规则名称添加"性能"标识
UPDATE audit_rules SET name = 'N+1查询 - 性能问题' WHERE rule_code = 'PERF001';
UPDATE audit_rules SET name = '内存泄漏 - 性能问题' WHERE rule_code = 'PERF002';
UPDATE audit_rules SET name = '低效算法 - 性能问题' WHERE rule_code = 'PERF003';
UPDATE audit_rules SET name = '不必要的对象创建 - 性能问题' WHERE rule_code = 'PERF004';
UPDATE audit_rules SET name = '同步阻塞 - 性能问题' WHERE rule_code = 'PERF005';

-- 代码质量规则集中的规则名称添加"质量"标识
UPDATE audit_rules SET name = '函数过长 - 代码质量问题' WHERE rule_code = 'CQ001';
UPDATE audit_rules SET name = '重复代码 - 代码质量问题' WHERE rule_code = 'CQ002';
UPDATE audit_rules SET name = '嵌套过深 - 代码质量问题' WHERE rule_code = 'CQ003';
UPDATE audit_rules SET name = '魔法数字 - 代码质量问题' WHERE rule_code = 'CQ004';
UPDATE audit_rules SET name = '缺少错误处理 - 代码质量问题' WHERE rule_code = 'CQ005';
UPDATE audit_rules SET name = '未使用的变量 - 代码质量问题' WHERE rule_code = 'CQ006';
UPDATE audit_rules SET name = '命名不规范 - 代码质量问题' WHERE rule_code = 'CQ007';
UPDATE audit_rules SET name = '注释缺失 - 代码质量问题' WHERE rule_code = 'CQ008';

-- 批量规则中质量规则的名称添加"质量"标识
UPDATE audit_rules SET name = '调试代码未移除 - 质量问题' WHERE rule_code = 'BATCH-010';
UPDATE audit_rules SET name = '缺少日志记录 - 质量问题' WHERE rule_code = 'BATCH-014';
UPDATE audit_rules SET name = '缺少数据验证 - 质量问题' WHERE rule_code = 'BATCH-016';
UPDATE audit_rules SET name = '缺少异常处理 - 质量问题' WHERE rule_code = 'BATCH-018';
UPDATE audit_rules SET name = '硬编码的IP地址 - 质量问题' WHERE rule_code = 'BATCH-020';

-- ============== 第二步：按分类规则统一更新所有规则的 category ==============

-- 1. 带有"性能"的规则 → performance
UPDATE audit_rules SET category = 'performance' WHERE name LIKE '%性能%';

-- 2. 带有"质量"的规则 → quality
UPDATE audit_rules SET category = 'quality' WHERE name LIKE '%质量%';

-- 3. 其他所有规则 → security（漏洞规则）
UPDATE audit_rules SET category = 'security'
WHERE category NOT IN ('quality', 'performance');

-- ============== 第三步：按分类规则统一更新所有规则集的 rule_type ==============

-- 1. 规则集名带有"性能"的 → performance
UPDATE audit_rule_sets SET rule_type = 'performance' WHERE name LIKE '%性能%';

-- 2. 规则集名带有"质量"的 → quality
UPDATE audit_rule_sets SET rule_type = 'quality' WHERE name LIKE '%质量%';

-- 3. 其他所有规则集 → security（漏洞规则集）
UPDATE audit_rule_sets SET rule_type = 'security'
WHERE rule_type NOT IN ('quality', 'performance')
AND rule_type != 'custom';

-- ============== 验证结果 ==============

-- 查看规则分类分布
SELECT '规则分类分布' as info;
SELECT category, COUNT(*) as count
FROM audit_rules
GROUP BY category
ORDER BY category;

-- 查看规则集类型分布
SELECT '规则集类型分布' as info;
SELECT rule_type, COUNT(*) as count
FROM audit_rule_sets
GROUP BY rule_type
ORDER BY rule_type;

-- 查看各类别规则样本
SELECT '性能规则样本' as type, rule_code, name FROM audit_rules WHERE category = 'performance' LIMIT 10;
SELECT '质量规则样本' as type, rule_code, name FROM audit_rules WHERE category = 'quality' LIMIT 10;
SELECT '漏洞规则样本' as type, rule_code, name FROM audit_rules WHERE category = 'security' LIMIT 10;

-- 检查是否有不符合分类规则的规则（名称含"性能"但category不是performance，或名称含"质量"但category不是quality）
SELECT '分类异常检查' as info;
SELECT rule_code, name, category
FROM audit_rules
WHERE (name LIKE '%性能%' AND category != 'performance')
   OR (name LIKE '%质量%' AND category != 'quality')
   OR (name NOT LIKE '%性能%' AND name NOT LIKE '%质量%' AND category NOT IN ('security'));
