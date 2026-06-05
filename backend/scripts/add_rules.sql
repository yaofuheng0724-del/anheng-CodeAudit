-- 批量添加规则到数据库
-- 首先，让我们插入第1批规则集
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第1批',
        '批量生成的第1批10条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        true,
        true,
        100,
        'd08fb5c6-f1c4-463a-9618-0742868fb868',
        NOW(),
        NOW()
    ) RETURNING id
)
INSERT INTO audit_rules (
    id, rule_set_id, rule_code, name, description,
    category, severity, custom_prompt, fix_suggestion,
    enabled, sort_order, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    id,
    'BATCH-001',
    '不安全的字符串拼接 - 可能导致注入',
    '检测使用字符串拼接而非参数化的代码',
    'security',
    'medium',
    '检查是否存在使用字符串拼接的代码，可能导致各种注入风险。应该使用参数化查询。',
    '使用参数化查询或预编译语句',
    true,
    1,
    NOW(),
    NOW()
FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-002', '硬编码的API密钥 - 安全风险', '检测代码中硬编码的API密钥', 'security', 'critical', '检查是否存在硬编码在代码中的API密钥、密码等敏感信息。这些应该放在环境变量或密钥管理系统中。', '将敏感信息移到环境变量或密钥管理系统', true, 2, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-003', '未使用的导入 - 代码质量问题', '检测导入但未使用的包或模块', 'quality', 'low', '检查是否存在导入但未使用的包或模块，这会增加代码复杂度。', '删除未使用的导入', true, 3, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-004', '缺少输入验证 - 用户输入未验证', '检测对用户输入缺少验证的代码', 'security', 'high', '检查是否存在对用户输入缺少验证的代码，这可能导致各种安全问题。', '对所有用户输入进行严格的验证和过滤', true, 4, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-005', '使用不安全的加密算法 - 安全问题', '检测使用弱加密算法的代码', 'security', 'critical', '检查是否使用了不安全的加密算法，如MD5、SHA1、DES等。应该使用更强的算法。', '使用更安全的加密算法如AES-256、SHA-256等', true, 5, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-006', '缺少速率限制 - 可能导致暴力破解', '检测缺少速率限制的接口', 'security', 'high', '检查是否存在缺少速率限制的接口，这可能导致暴力破解或DoS攻击。', '为敏感接口添加速率限制', true, 6, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-007', '不安全的文件操作 - 路径遍历风险', '检测不安全的文件操作代码', 'security', 'high', '检查是否存在不安全的文件操作，可能导致路径遍历或其他文件安全问题。', '确保文件操作路径在安全目录内，使用白名单验证', true, 7, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-008', '缺少权限检查 - 可能导致未授权访问', '检测缺少权限检查的代码', 'security', 'critical', '检查是否存在缺少权限检查的代码，这可能导致未授权访问。', '在关键操作前添加权限验证', true, 8, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-009', '不安全的随机数 - 使用非密码学安全随机', '检测使用非密码学安全随机数生成器的代码', 'security', 'medium', '检查是否使用了非密码学安全的随机数生成器，在安全场景下应该使用安全的随机数生成器。', '使用密码学安全的随机数生成器', true, 9, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-010', '调试代码未移除 - 生产环境风险', '检测生产环境中遗留的调试代码', 'quality', 'medium', '检查是否存在生产环境中不应该存在的调试代码，如console.log、print调试信息等。', '移除或禁用生产环境中的调试代码', true, 10, NOW(), NOW() FROM new_rule_set;

-- 插入第2批规则集
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第2批',
        '批量生成的第2批10条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        true,
        true,
        101,
        'd08fb5c6-f1c4-463a-9618-0742868fb868',
        NOW(),
        NOW()
    ) RETURNING id
)
INSERT INTO audit_rules (
    id, rule_set_id, rule_code, name, description,
    category, severity, custom_prompt, fix_suggestion,
    enabled, sort_order, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    id,
    'BATCH-011',
    '缺少HTTPS - 数据传输不安全',
    '检测使用HTTP而非HTTPS的代码',
    'security',
    'high',
    '检查是否存在使用HTTP而非HTTPS的代码，这可能导致数据传输过程中被窃取或篡改。',
    '使用HTTPS加密数据传输',
    true,
    11,
    NOW(),
    NOW()
FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-012', '不安全的反序列化 - 可能导致RCE', '检测不安全的反序列化操作', 'security', 'critical', '检查是否存在不安全的反序列化操作，这可能导致远程代码执行漏洞。', '使用安全的序列化格式，或对反序列化输入进行严格验证', true, 12, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-013', '硬编码的数据库连接信息', '检测硬编码的数据库连接信息', 'security', 'critical', '检查是否存在硬编码的数据库连接字符串、用户名、密码等敏感信息。', '将数据库连接信息移到环境变量或配置文件中', true, 13, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-014', '缺少日志记录 - 难以追踪问题', '检测关键操作缺少日志记录的代码', 'quality', 'low', '检查是否存在关键操作缺少日志记录的代码，这会影响问题追踪和安全审计。', '为关键操作添加适当的日志记录', true, 14, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-015', '不安全的正则表达式 - ReDoS风险', '检测可能导致正则表达式拒绝服务的代码', 'security', 'medium', '检查是否存在可能导致正则表达式拒绝服务(ReDoS)的复杂正则表达式。', '简化正则表达式，使用非贪婪匹配，添加超时限制', true, 15, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-016', '缺少数据验证 - 数据完整性风险', '检测缺少数据验证的代码', 'quality', 'medium', '检查是否存在缺少数据验证的代码，这可能导致数据完整性问题。', '添加数据类型、范围、格式等验证', true, 16, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-017', '不安全的SQL查询 - 注入风险', '检测可能导致SQL注入的代码', 'security', 'critical', '检查是否存在SQL拼接或其他可能导致SQL注入的代码。', '使用参数化查询或ORM框架', true, 17, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-018', '缺少异常处理 - 程序稳定性风险', '检测缺少适当异常处理的代码', 'quality', 'medium', '检查是否存在缺少适当异常处理的代码，这可能导致程序崩溃或异常行为。', '添加适当的try-catch或异常处理机制', true, 18, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-019', '不安全的跨域资源共享 - CORS', '检测CORS配置过于宽松的代码', 'security', 'high', '检查是否存在CORS配置过于宽松的代码，如Access-Control-Allow-Origin设置为*。', '限制允许访问的域名，避免使用通配符', true, 19, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-020', '硬编码的IP地址 - 可维护性问题', '检测硬编码的IP地址', 'quality', 'low', '检查是否存在硬编码的IP地址，这会降低代码的可移植性和可维护性。', '将IP地址移到配置文件中', true, 20, NOW(), NOW() FROM new_rule_set;

-- 查询结果
SELECT '插入完成！' AS status;
SELECT rs.name, rs.id, COUNT(r.id) AS rules_count
FROM audit_rule_sets rs
LEFT JOIN audit_rules r ON rs.id = r.rule_set_id
WHERE rs.name LIKE '批量规则集%'
GROUP BY rs.name, rs.id;
