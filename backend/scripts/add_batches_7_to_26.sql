-- 批量添加剩余规则 - 第7-26批 (BATCH-101 ~ BATCH-500)
-- 此脚本将添加400条规则，使总数达到500条


-- ========================================
-- 第7批 (BATCH-101 ~ BATCH-120)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第7批',
        '批量生成的第7批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        107,
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
SELECT gen_random_uuid(), id, 'BATCH-101', '性能测试配置不当', '检测性能测试配置不安全的代码', 'security', 'medium', '检查性能测试的配置是否遵循安全最佳实践。', '安全配置性能测试', true, 101, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-102', '缺少压力测试保护', '检测缺少压力测试保护机制的代码', 'security', 'high', '检查是否缺少必要的压力测试保护措施。', '添加压力测试保护措施', true, 102, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-103', '不安全的负载测试实现', '检测负载测试实现不安全的代码', 'security', 'critical', '检查负载测试的实现是否存在安全漏洞。', '重新安全实现负载测试', true, 103, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-104', '代码复用验证不足', '检测代码复用验证不充分的代码', 'security', 'medium', '检查代码复用的验证逻辑是否充分。', '增强代码复用验证逻辑', true, 104, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-105', '可维护性信息泄露', '检测可维护性可能泄露信息的代码', 'security', 'high', '检查是否可能通过可维护性泄露敏感信息。', '防止通过可维护性泄露信息', true, 105, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-106', '可读性代码质量问题', '检测可读性相关的代码质量问题', 'quality', 'medium', '检查可读性相关的代码质量，如可维护性、可读性等。', '改进可读性代码质量', true, 106, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-107', '缺少可扩展性错误处理', '检测可扩展性错误处理不当的代码', 'quality', 'low', '检查可扩展性相关操作的错误处理是否完善。', '完善可扩展性错误处理', true, 107, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-108', '可测试性性能问题', '检测可测试性相关的性能问题', 'quality', 'medium', '检查可测试性是否存在性能优化空间。', '优化可测试性性能', true, 108, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-109', '缺少可部署性文档', '检测可部署性缺少文档的代码', 'quality', 'low', '检查可部署性是否有充分的文档说明。', '添加可部署性文档', true, 109, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-110', '可观测性 - 随机数', '检测可观测性相关的随机数问题', 'security', 'high', '检查代码中是否存在可观测性相关的随机数安全问题。', '修复可观测性相关的随机数问题', true, 110, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-111', '监控配置不当', '检测监控配置不安全的代码', 'security', 'medium', '检查监控的配置是否遵循安全最佳实践。', '安全配置监控', true, 111, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-112', '缺少告警保护', '检测缺少告警保护机制的代码', 'security', 'high', '检查是否缺少必要的告警保护措施。', '添加告警保护措施', true, 112, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-113', '不安全的链路追踪实现', '检测链路追踪实现不安全的代码', 'security', 'critical', '检查链路追踪的实现是否存在安全漏洞。', '重新安全实现链路追踪', true, 113, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-114', '日志聚合验证不足', '检测日志聚合验证不充分的代码', 'security', 'medium', '检查日志聚合的验证逻辑是否充分。', '增强日志聚合验证逻辑', true, 114, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-115', '指标收集信息泄露', '检测指标收集可能泄露信息的代码', 'security', 'high', '检查是否可能通过指标收集泄露敏感信息。', '防止通过指标收集泄露信息', true, 115, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-116', '配置管理代码质量问题', '检测配置管理相关的代码质量问题', 'quality', 'medium', '检查配置管理相关的代码质量，如可维护性、可读性等。', '改进配置管理代码质量', true, 116, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-117', '缺少环境管理错误处理', '检测环境管理错误处理不当的代码', 'quality', 'low', '检查环境管理相关操作的错误处理是否完善。', '完善环境管理错误处理', true, 117, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-118', '部署流程性能问题', '检测部署流程相关的性能问题', 'quality', 'medium', '检查部署流程是否存在性能优化空间。', '优化部署流程性能', true, 118, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-119', '缺少回滚策略文档', '检测回滚策略缺少文档的代码', 'quality', 'low', '检查回滚策略是否有充分的文档说明。', '添加回滚策略文档', true, 119, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-120', '蓝绿部署 - 解码', '检测蓝绿部署相关的解码问题', 'security', 'high', '检查代码中是否存在蓝绿部署相关的解码安全问题。', '修复蓝绿部署相关的解码问题', true, 120, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第8批 (BATCH-121 ~ BATCH-140)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第8批',
        '批量生成的第8批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        108,
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
SELECT gen_random_uuid(), id, 'BATCH-121', '金丝雀发布配置不当', '检测金丝雀发布配置不安全的代码', 'security', 'medium', '检查金丝雀发布的配置是否遵循安全最佳实践。', '安全配置金丝雀发布', true, 121, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-122', '缺少A/B测试保护', '检测缺少A/B测试保护机制的代码', 'security', 'high', '检查是否缺少必要的A/B测试保护措施。', '添加A/B测试保护措施', true, 122, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-123', '不安全的特性开关实现', '检测特性开关实现不安全的代码', 'security', 'critical', '检查特性开关的实现是否存在安全漏洞。', '重新安全实现特性开关', true, 123, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-124', '配置热更新验证不足', '检测配置热更新验证不充分的代码', 'security', 'medium', '检查配置热更新的验证逻辑是否充分。', '增强配置热更新验证逻辑', true, 124, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-125', '灰度发布信息泄露', '检测灰度发布可能泄露信息的代码', 'security', 'high', '检查是否可能通过灰度发布泄露敏感信息。', '防止通过灰度发布泄露信息', true, 125, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-126', '流量控制代码质量问题', '检测流量控制相关的代码质量问题', 'quality', 'medium', '检查流量控制相关的代码质量，如可维护性、可读性等。', '改进流量控制代码质量', true, 126, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-127', '缺少限流错误处理', '检测限流错误处理不当的代码', 'quality', 'low', '检查限流相关操作的错误处理是否完善。', '完善限流错误处理', true, 127, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-128', '熔断性能问题', '检测熔断相关的性能问题', 'quality', 'medium', '检查熔断是否存在性能优化空间。', '优化熔断性能', true, 128, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-129', '缺少降级文档', '检测降级缺少文档的代码', 'quality', 'low', '检查降级是否有充分的文档说明。', '添加降级文档', true, 129, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-130', '重试 - 校验', '检测重试相关的校验问题', 'security', 'high', '检查代码中是否存在重试相关的校验安全问题。', '修复重试相关的校验问题', true, 130, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-131', '超时配置不当', '检测超时配置不安全的代码', 'security', 'medium', '检查超时的配置是否遵循安全最佳实践。', '安全配置超时', true, 131, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-132', '缺少幂等性保护', '检测缺少幂等性保护机制的代码', 'security', 'high', '检查是否缺少必要的幂等性保护措施。', '添加幂等性保护措施', true, 132, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-133', '不安全的一致性实现', '检测一致性实现不安全的代码', 'security', 'critical', '检查一致性的实现是否存在安全漏洞。', '重新安全实现一致性', true, 133, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-134', '可用性验证不足', '检测可用性验证不充分的代码', 'security', 'medium', '检查可用性的验证逻辑是否充分。', '增强可用性验证逻辑', true, 134, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-135', '分区容错信息泄露', '检测分区容错可能泄露信息的代码', 'security', 'high', '检查是否可能通过分区容错泄露敏感信息。', '防止通过分区容错泄露信息', true, 135, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-136', 'CAP理论代码质量问题', '检测CAP理论相关的代码质量问题', 'quality', 'medium', '检查CAP理论相关的代码质量，如可维护性、可读性等。', '改进CAP理论代码质量', true, 136, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-137', '缺少BASE理论错误处理', '检测BASE理论错误处理不当的代码', 'quality', 'low', '检查BASE理论相关操作的错误处理是否完善。', '完善BASE理论错误处理', true, 137, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-138', '认证性能问题', '检测认证相关的性能问题', 'quality', 'medium', '检查认证是否存在性能优化空间。', '优化认证性能', true, 138, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-139', '缺少授权文档', '检测授权缺少文档的代码', 'quality', 'low', '检查授权是否有充分的文档说明。', '添加授权文档', true, 139, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-140', '会话管理 - 检测', '检测会话管理相关的检测问题', 'security', 'high', '检查代码中是否存在会话管理相关的检测安全问题。', '修复会话管理相关的检测问题', true, 140, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第9批 (BATCH-141 ~ BATCH-160)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第9批',
        '批量生成的第9批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        109,
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
SELECT gen_random_uuid(), id, 'BATCH-141', '输入验证配置不当', '检测输入验证配置不安全的代码', 'security', 'medium', '检查输入验证的配置是否遵循安全最佳实践。', '安全配置输入验证', true, 141, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-142', '缺少输出编码保护', '检测缺少输出编码保护机制的代码', 'security', 'high', '检查是否缺少必要的输出编码保护措施。', '添加输出编码保护措施', true, 142, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-143', '不安全的加密实现', '检测加密实现不安全的代码', 'security', 'critical', '检查加密的实现是否存在安全漏洞。', '重新安全实现加密', true, 143, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-144', '密钥管理验证不足', '检测密钥管理验证不充分的代码', 'security', 'medium', '检查密钥管理的验证逻辑是否充分。', '增强密钥管理验证逻辑', true, 144, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-145', '错误处理信息泄露', '检测错误处理可能泄露信息的代码', 'security', 'high', '检查是否可能通过错误处理泄露敏感信息。', '防止通过错误处理泄露信息', true, 145, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-146', '日志记录代码质量问题', '检测日志记录相关的代码质量问题', 'quality', 'medium', '检查日志记录相关的代码质量，如可维护性、可读性等。', '改进日志记录代码质量', true, 146, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-147', '缺少配置管理错误处理', '检测配置管理错误处理不当的代码', 'quality', 'low', '检查配置管理相关操作的错误处理是否完善。', '完善配置管理错误处理', true, 147, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-148', '文件操作性能问题', '检测文件操作相关的性能问题', 'quality', 'medium', '检查文件操作是否存在性能优化空间。', '优化文件操作性能', true, 148, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-149', '缺少网络通信文档', '检测网络通信缺少文档的代码', 'quality', 'low', '检查网络通信是否有充分的文档说明。', '添加网络通信文档', true, 149, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-150', '数据库 - 加密', '检测数据库相关的加密问题', 'security', 'high', '检查代码中是否存在数据库相关的加密安全问题。', '修复数据库相关的加密问题', true, 150, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-151', '缓存配置不当', '检测缓存配置不安全的代码', 'security', 'medium', '检查缓存的配置是否遵循安全最佳实践。', '安全配置缓存', true, 151, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-152', '缺少队列保护', '检测缺少队列保护机制的代码', 'security', 'high', '检查是否缺少必要的队列保护措施。', '添加队列保护措施', true, 152, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-153', '不安全的定时任务实现', '检测定时任务实现不安全的代码', 'security', 'critical', '检查定时任务的实现是否存在安全漏洞。', '重新安全实现定时任务', true, 153, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-154', 'API设计验证不足', '检测API设计验证不充分的代码', 'security', 'medium', '检查API设计的验证逻辑是否充分。', '增强API设计验证逻辑', true, 154, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-155', '微服务信息泄露', '检测微服务可能泄露信息的代码', 'security', 'high', '检查是否可能通过微服务泄露敏感信息。', '防止通过微服务泄露信息', true, 155, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-156', '容器代码质量问题', '检测容器相关的代码质量问题', 'quality', 'medium', '检查容器相关的代码质量，如可维护性、可读性等。', '改进容器代码质量', true, 156, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-157', '缺少Kubernetes错误处理', '检测Kubernetes错误处理不当的代码', 'quality', 'low', '检查Kubernetes相关操作的错误处理是否完善。', '完善Kubernetes错误处理', true, 157, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-158', '云服务性能问题', '检测云服务相关的性能问题', 'quality', 'medium', '检查云服务是否存在性能优化空间。', '优化云服务性能', true, 158, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-159', '缺少第三方集成文档', '检测第三方集成缺少文档的代码', 'quality', 'low', '检查第三方集成是否有充分的文档说明。', '添加第三方集成文档', true, 159, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-160', '依赖管理 - 凭证', '检测依赖管理相关的凭证问题', 'security', 'high', '检查代码中是否存在依赖管理相关的凭证安全问题。', '修复依赖管理相关的凭证问题', true, 160, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第10批 (BATCH-161 ~ BATCH-180)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第10批',
        '批量生成的第10批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        110,
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
SELECT gen_random_uuid(), id, 'BATCH-161', '补丁管理配置不当', '检测补丁管理配置不安全的代码', 'security', 'medium', '检查补丁管理的配置是否遵循安全最佳实践。', '安全配置补丁管理', true, 161, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-162', '缺少变更管理保护', '检测缺少变更管理保护机制的代码', 'security', 'high', '检查是否缺少必要的变更管理保护措施。', '添加变更管理保护措施', true, 162, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-163', '不安全的发布管理实现', '检测发布管理实现不安全的代码', 'security', 'critical', '检查发布管理的实现是否存在安全漏洞。', '重新安全实现发布管理', true, 163, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-164', '监控验证不足', '检测监控验证不充分的代码', 'security', 'medium', '检查监控的验证逻辑是否充分。', '增强监控验证逻辑', true, 164, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-165', '告警信息泄露', '检测告警可能泄露信息的代码', 'security', 'high', '检查是否可能通过告警泄露敏感信息。', '防止通过告警泄露信息', true, 165, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-166', '备份代码质量问题', '检测备份相关的代码质量问题', 'quality', 'medium', '检查备份相关的代码质量，如可维护性、可读性等。', '改进备份代码质量', true, 166, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-167', '缺少恢复错误处理', '检测恢复错误处理不当的代码', 'quality', 'low', '检查恢复相关操作的错误处理是否完善。', '完善恢复错误处理', true, 167, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-168', '灾难恢复性能问题', '检测灾难恢复相关的性能问题', 'quality', 'medium', '检查灾难恢复是否存在性能优化空间。', '优化灾难恢复性能', true, 168, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-169', '缺少安全测试文档', '检测安全测试缺少文档的代码', 'quality', 'low', '检查安全测试是否有充分的文档说明。', '添加安全测试文档', true, 169, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-170', '渗透测试 - 标准化', '检测渗透测试相关的标准化问题', 'security', 'high', '检查代码中是否存在渗透测试相关的标准化安全问题。', '修复渗透测试相关的标准化问题', true, 170, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-171', '代码审计配置不当', '检测代码审计配置不安全的代码', 'security', 'medium', '检查代码审计的配置是否遵循安全最佳实践。', '安全配置代码审计', true, 171, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-172', '缺少静态分析保护', '检测缺少静态分析保护机制的代码', 'security', 'high', '检查是否缺少必要的静态分析保护措施。', '添加静态分析保护措施', true, 172, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-173', '不安全的动态分析实现', '检测动态分析实现不安全的代码', 'security', 'critical', '检查动态分析的实现是否存在安全漏洞。', '重新安全实现动态分析', true, 173, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-174', '模糊测试验证不足', '检测模糊测试验证不充分的代码', 'security', 'medium', '检查模糊测试的验证逻辑是否充分。', '增强模糊测试验证逻辑', true, 174, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-175', '安全评审信息泄露', '检测安全评审可能泄露信息的代码', 'security', 'high', '检查是否可能通过安全评审泄露敏感信息。', '防止通过安全评审泄露信息', true, 175, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-176', '威胁建模代码质量问题', '检测威胁建模相关的代码质量问题', 'quality', 'medium', '检查威胁建模相关的代码质量，如可维护性、可读性等。', '改进威胁建模代码质量', true, 176, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-177', '缺少风险评估错误处理', '检测风险评估错误处理不当的代码', 'quality', 'low', '检查风险评估相关操作的错误处理是否完善。', '完善风险评估错误处理', true, 177, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-178', '合规性性能问题', '检测合规性相关的性能问题', 'quality', 'medium', '检查合规性是否存在性能优化空间。', '优化合规性性能', true, 178, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-179', '缺少隐私保护文档', '检测隐私保护缺少文档的代码', 'quality', 'low', '检查隐私保护是否有充分的文档说明。', '添加隐私保护文档', true, 179, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-180', '数据保护 - 实现', '检测数据保护相关的实现问题', 'security', 'high', '检查代码中是否存在数据保护相关的实现安全问题。', '修复数据保护相关的实现问题', true, 180, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第11批 (BATCH-181 ~ BATCH-200)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第11批',
        '批量生成的第11批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        111,
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
SELECT gen_random_uuid(), id, 'BATCH-181', '数据脱敏配置不当', '检测数据脱敏配置不安全的代码', 'security', 'medium', '检查数据脱敏的配置是否遵循安全最佳实践。', '安全配置数据脱敏', true, 181, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-182', '缺少数据分类保护', '检测缺少数据分类保护机制的代码', 'security', 'high', '检查是否缺少必要的数据分类保护措施。', '添加数据分类保护措施', true, 182, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-183', '不安全的访问控制实现', '检测访问控制实现不安全的代码', 'security', 'critical', '检查访问控制的实现是否存在安全漏洞。', '重新安全实现访问控制', true, 183, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-184', '多因素认证验证不足', '检测多因素认证验证不充分的代码', 'security', 'medium', '检查多因素认证的验证逻辑是否充分。', '增强多因素认证验证逻辑', true, 184, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-185', '单点登录信息泄露', '检测单点登录可能泄露信息的代码', 'security', 'high', '检查是否可能通过单点登录泄露敏感信息。', '防止通过单点登录泄露信息', true, 185, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-186', 'OAuth代码质量问题', '检测OAuth相关的代码质量问题', 'quality', 'medium', '检查OAuth相关的代码质量，如可维护性、可读性等。', '改进OAuth代码质量', true, 186, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-187', '缺少JWT错误处理', '检测JWT错误处理不当的代码', 'quality', 'low', '检查JWT相关操作的错误处理是否完善。', '完善JWT错误处理', true, 187, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-188', 'SAML性能问题', '检测SAML相关的性能问题', 'quality', 'medium', '检查SAML是否存在性能优化空间。', '优化SAML性能', true, 188, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-189', '缺少证书管理文档', '检测证书管理缺少文档的代码', 'quality', 'low', '检查证书管理是否有充分的文档说明。', '添加证书管理文档', true, 189, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-190', 'PKI - 审核', '检测PKI相关的审核问题', 'security', 'high', '检查代码中是否存在PKI相关的审核安全问题。', '修复PKI相关的审核问题', true, 190, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-191', 'TLS配置不当', '检测TLS配置不安全的代码', 'security', 'medium', '检查TLS的配置是否遵循安全最佳实践。', '安全配置TLS', true, 191, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-192', '缺少SSL保护', '检测缺少SSL保护机制的代码', 'security', 'high', '检查是否缺少必要的SSL保护措施。', '添加SSL保护措施', true, 192, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-193', '不安全的HTTPS实现', '检测HTTPS实现不安全的代码', 'security', 'critical', '检查HTTPS的实现是否存在安全漏洞。', '重新安全实现HTTPS', true, 193, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-194', 'WAF验证不足', '检测WAF验证不充分的代码', 'security', 'medium', '检查WAF的验证逻辑是否充分。', '增强WAF验证逻辑', true, 194, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-195', 'IPS信息泄露', '检测IPS可能泄露信息的代码', 'security', 'high', '检查是否可能通过IPS泄露敏感信息。', '防止通过IPS泄露信息', true, 195, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-196', 'IDS代码质量问题', '检测IDS相关的代码质量问题', 'quality', 'medium', '检查IDS相关的代码质量，如可维护性、可读性等。', '改进IDS代码质量', true, 196, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-197', '缺少防火墙错误处理', '检测防火墙错误处理不当的代码', 'quality', 'low', '检查防火墙相关操作的错误处理是否完善。', '完善防火墙错误处理', true, 197, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-198', '网络分段性能问题', '检测网络分段相关的性能问题', 'quality', 'medium', '检查网络分段是否存在性能优化空间。', '优化网络分段性能', true, 198, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-199', '缺少VPN文档', '检测VPN缺少文档的代码', 'quality', 'low', '检查VPN是否有充分的文档说明。', '添加VPN文档', true, 199, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-200', '远程访问 - 随机数', '检测远程访问相关的随机数问题', 'security', 'high', '检查代码中是否存在远程访问相关的随机数安全问题。', '修复远程访问相关的随机数问题', true, 200, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第12批 (BATCH-201 ~ BATCH-220)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第12批',
        '批量生成的第12批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        112,
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
SELECT gen_random_uuid(), id, 'BATCH-201', '物理安全配置不当', '检测物理安全配置不安全的代码', 'security', 'medium', '检查物理安全的配置是否遵循安全最佳实践。', '安全配置物理安全', true, 201, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-202', '缺少环境安全保护', '检测缺少环境安全保护机制的代码', 'security', 'high', '检查是否缺少必要的环境安全保护措施。', '添加环境安全保护措施', true, 202, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-203', '不安全的供应链安全实现', '检测供应链安全实现不安全的代码', 'security', 'critical', '检查供应链安全的实现是否存在安全漏洞。', '重新安全实现供应链安全', true, 203, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-204', '开源安全验证不足', '检测开源安全验证不充分的代码', 'security', 'medium', '检查开源安全的验证逻辑是否充分。', '增强开源安全验证逻辑', true, 204, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-205', '组件分析信息泄露', '检测组件分析可能泄露信息的代码', 'security', 'high', '检查是否可能通过组件分析泄露敏感信息。', '防止通过组件分析泄露信息', true, 205, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-206', '漏洞扫描代码质量问题', '检测漏洞扫描相关的代码质量问题', 'quality', 'medium', '检查漏洞扫描相关的代码质量，如可维护性、可读性等。', '改进漏洞扫描代码质量', true, 206, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-207', '缺少补丁管理错误处理', '检测补丁管理错误处理不当的代码', 'quality', 'low', '检查补丁管理相关操作的错误处理是否完善。', '完善补丁管理错误处理', true, 207, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-208', '配置核查性能问题', '检测配置核查相关的性能问题', 'quality', 'medium', '检查配置核查是否存在性能优化空间。', '优化配置核查性能', true, 208, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-209', '缺少安全编码文档', '检测安全编码缺少文档的代码', 'quality', 'low', '检查安全编码是否有充分的文档说明。', '添加安全编码文档', true, 209, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-210', '安全架构 - 解码', '检测安全架构相关的解码问题', 'security', 'high', '检查代码中是否存在安全架构相关的解码安全问题。', '修复安全架构相关的解码问题', true, 210, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-211', '安全设计配置不当', '检测安全设计配置不安全的代码', 'security', 'medium', '检查安全设计的配置是否遵循安全最佳实践。', '安全配置安全设计', true, 211, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-212', '缺少DevSecOps保护', '检测缺少DevSecOps保护机制的代码', 'security', 'high', '检查是否缺少必要的DevSecOps保护措施。', '添加DevSecOps保护措施', true, 212, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-213', '不安全的CI/CD安全实现', '检测CI/CD安全实现不安全的代码', 'security', 'critical', '检查CI/CD安全的实现是否存在安全漏洞。', '重新安全实现CI/CD安全', true, 213, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-214', 'Git安全验证不足', '检测Git安全验证不充分的代码', 'security', 'medium', '检查Git安全的验证逻辑是否充分。', '增强Git安全验证逻辑', true, 214, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-215', '代码库安全信息泄露', '检测代码库安全可能泄露信息的代码', 'security', 'high', '检查是否可能通过代码库安全泄露敏感信息。', '防止通过代码库安全泄露信息', true, 215, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-216', 'Artifact安全代码质量问题', '检测Artifact安全相关的代码质量问题', 'quality', 'medium', '检查Artifact安全相关的代码质量，如可维护性、可读性等。', '改进Artifact安全代码质量', true, 216, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-217', '缺少容器安全错误处理', '检测容器安全错误处理不当的代码', 'quality', 'low', '检查容器安全相关操作的错误处理是否完善。', '完善容器安全错误处理', true, 217, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-218', '镜像安全性能问题', '检测镜像安全相关的性能问题', 'quality', 'medium', '检查镜像安全是否存在性能优化空间。', '优化镜像安全性能', true, 218, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-219', '缺少运行时安全文档', '检测运行时安全缺少文档的代码', 'quality', 'low', '检查运行时安全是否有充分的文档说明。', '添加运行时安全文档', true, 219, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-220', 'RASP - 校验', '检测RASP相关的校验问题', 'security', 'high', '检查代码中是否存在RASP相关的校验安全问题。', '修复RASP相关的校验问题', true, 220, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第13批 (BATCH-221 ~ BATCH-240)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第13批',
        '批量生成的第13批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        113,
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
SELECT gen_random_uuid(), id, 'BATCH-221', 'SAST配置不当', '检测SAST配置不安全的代码', 'security', 'medium', '检查SAST的配置是否遵循安全最佳实践。', '安全配置SAST', true, 221, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-222', '缺少DAST保护', '检测缺少DAST保护机制的代码', 'security', 'high', '检查是否缺少必要的DAST保护措施。', '添加DAST保护措施', true, 222, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-223', '不安全的IAST实现', '检测IAST实现不安全的代码', 'security', 'critical', '检查IAST的实现是否存在安全漏洞。', '重新安全实现IAST', true, 223, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-224', 'SCA验证不足', '检测SCA验证不充分的代码', 'security', 'medium', '检查SCA的验证逻辑是否充分。', '增强SCA验证逻辑', true, 224, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-225', '代码格式信息泄露', '检测代码格式可能泄露信息的代码', 'security', 'high', '检查是否可能通过代码格式泄露敏感信息。', '防止通过代码格式泄露信息', true, 225, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-226', '命名规范代码质量问题', '检测命名规范相关的代码质量问题', 'quality', 'medium', '检查命名规范相关的代码质量，如可维护性、可读性等。', '改进命名规范代码质量', true, 226, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-227', '缺少注释质量错误处理', '检测注释质量错误处理不当的代码', 'quality', 'low', '检查注释质量相关操作的错误处理是否完善。', '完善注释质量错误处理', true, 227, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-228', '函数设计性能问题', '检测函数设计相关的性能问题', 'quality', 'medium', '检查函数设计是否存在性能优化空间。', '优化函数设计性能', true, 228, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-229', '缺少类设计文档', '检测类设计缺少文档的代码', 'quality', 'low', '检查类设计是否有充分的文档说明。', '添加类设计文档', true, 229, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-230', '模块划分 - 检测', '检测模块划分相关的检测问题', 'security', 'high', '检查代码中是否存在模块划分相关的检测安全问题。', '修复模块划分相关的检测问题', true, 230, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-231', '包结构配置不当', '检测包结构配置不安全的代码', 'security', 'medium', '检查包结构的配置是否遵循安全最佳实践。', '安全配置包结构', true, 231, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-232', '缺少依赖管理保护', '检测缺少依赖管理保护机制的代码', 'security', 'high', '检查是否缺少必要的依赖管理保护措施。', '添加依赖管理保护措施', true, 232, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-233', '不安全的异常处理实现', '检测异常处理实现不安全的代码', 'security', 'critical', '检查异常处理的实现是否存在安全漏洞。', '重新安全实现异常处理', true, 233, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-234', '日志记录验证不足', '检测日志记录验证不充分的代码', 'security', 'medium', '检查日志记录的验证逻辑是否充分。', '增强日志记录验证逻辑', true, 234, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-235', '单元测试信息泄露', '检测单元测试可能泄露信息的代码', 'security', 'high', '检查是否可能通过单元测试泄露敏感信息。', '防止通过单元测试泄露信息', true, 235, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-236', '集成测试代码质量问题', '检测集成测试相关的代码质量问题', 'quality', 'medium', '检查集成测试相关的代码质量，如可维护性、可读性等。', '改进集成测试代码质量', true, 236, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-237', '缺少端到端测试错误处理', '检测端到端测试错误处理不当的代码', 'quality', 'low', '检查端到端测试相关操作的错误处理是否完善。', '完善端到端测试错误处理', true, 237, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-238', '测试覆盖性能问题', '检测测试覆盖相关的性能问题', 'quality', 'medium', '检查测试覆盖是否存在性能优化空间。', '优化测试覆盖性能', true, 238, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-239', '缺少性能测试文档', '检测性能测试缺少文档的代码', 'quality', 'low', '检查性能测试是否有充分的文档说明。', '添加性能测试文档', true, 239, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-240', '压力测试 - 加密', '检测压力测试相关的加密问题', 'security', 'high', '检查代码中是否存在压力测试相关的加密安全问题。', '修复压力测试相关的加密问题', true, 240, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第14批 (BATCH-241 ~ BATCH-260)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第14批',
        '批量生成的第14批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        114,
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
SELECT gen_random_uuid(), id, 'BATCH-241', '负载测试配置不当', '检测负载测试配置不安全的代码', 'security', 'medium', '检查负载测试的配置是否遵循安全最佳实践。', '安全配置负载测试', true, 241, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-242', '缺少代码复用保护', '检测缺少代码复用保护机制的代码', 'security', 'high', '检查是否缺少必要的代码复用保护措施。', '添加代码复用保护措施', true, 242, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-243', '不安全的可维护性实现', '检测可维护性实现不安全的代码', 'security', 'critical', '检查可维护性的实现是否存在安全漏洞。', '重新安全实现可维护性', true, 243, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-244', '可读性验证不足', '检测可读性验证不充分的代码', 'security', 'medium', '检查可读性的验证逻辑是否充分。', '增强可读性验证逻辑', true, 244, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-245', '可扩展性信息泄露', '检测可扩展性可能泄露信息的代码', 'security', 'high', '检查是否可能通过可扩展性泄露敏感信息。', '防止通过可扩展性泄露信息', true, 245, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-246', '可测试性代码质量问题', '检测可测试性相关的代码质量问题', 'quality', 'medium', '检查可测试性相关的代码质量，如可维护性、可读性等。', '改进可测试性代码质量', true, 246, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-247', '缺少可部署性错误处理', '检测可部署性错误处理不当的代码', 'quality', 'low', '检查可部署性相关操作的错误处理是否完善。', '完善可部署性错误处理', true, 247, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-248', '可观测性性能问题', '检测可观测性相关的性能问题', 'quality', 'medium', '检查可观测性是否存在性能优化空间。', '优化可观测性性能', true, 248, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-249', '缺少监控文档', '检测监控缺少文档的代码', 'quality', 'low', '检查监控是否有充分的文档说明。', '添加监控文档', true, 249, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-250', '告警 - 凭证', '检测告警相关的凭证问题', 'security', 'high', '检查代码中是否存在告警相关的凭证安全问题。', '修复告警相关的凭证问题', true, 250, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-251', '链路追踪配置不当', '检测链路追踪配置不安全的代码', 'security', 'medium', '检查链路追踪的配置是否遵循安全最佳实践。', '安全配置链路追踪', true, 251, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-252', '缺少日志聚合保护', '检测缺少日志聚合保护机制的代码', 'security', 'high', '检查是否缺少必要的日志聚合保护措施。', '添加日志聚合保护措施', true, 252, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-253', '不安全的指标收集实现', '检测指标收集实现不安全的代码', 'security', 'critical', '检查指标收集的实现是否存在安全漏洞。', '重新安全实现指标收集', true, 253, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-254', '配置管理验证不足', '检测配置管理验证不充分的代码', 'security', 'medium', '检查配置管理的验证逻辑是否充分。', '增强配置管理验证逻辑', true, 254, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-255', '环境管理信息泄露', '检测环境管理可能泄露信息的代码', 'security', 'high', '检查是否可能通过环境管理泄露敏感信息。', '防止通过环境管理泄露信息', true, 255, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-256', '部署流程代码质量问题', '检测部署流程相关的代码质量问题', 'quality', 'medium', '检查部署流程相关的代码质量，如可维护性、可读性等。', '改进部署流程代码质量', true, 256, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-257', '缺少回滚策略错误处理', '检测回滚策略错误处理不当的代码', 'quality', 'low', '检查回滚策略相关操作的错误处理是否完善。', '完善回滚策略错误处理', true, 257, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-258', '蓝绿部署性能问题', '检测蓝绿部署相关的性能问题', 'quality', 'medium', '检查蓝绿部署是否存在性能优化空间。', '优化蓝绿部署性能', true, 258, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-259', '缺少金丝雀发布文档', '检测金丝雀发布缺少文档的代码', 'quality', 'low', '检查金丝雀发布是否有充分的文档说明。', '添加金丝雀发布文档', true, 259, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-260', 'A/B测试 - 标准化', '检测A/B测试相关的标准化问题', 'security', 'high', '检查代码中是否存在A/B测试相关的标准化安全问题。', '修复A/B测试相关的标准化问题', true, 260, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第15批 (BATCH-261 ~ BATCH-280)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第15批',
        '批量生成的第15批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        115,
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
SELECT gen_random_uuid(), id, 'BATCH-261', '特性开关配置不当', '检测特性开关配置不安全的代码', 'security', 'medium', '检查特性开关的配置是否遵循安全最佳实践。', '安全配置特性开关', true, 261, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-262', '缺少配置热更新保护', '检测缺少配置热更新保护机制的代码', 'security', 'high', '检查是否缺少必要的配置热更新保护措施。', '添加配置热更新保护措施', true, 262, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-263', '不安全的灰度发布实现', '检测灰度发布实现不安全的代码', 'security', 'critical', '检查灰度发布的实现是否存在安全漏洞。', '重新安全实现灰度发布', true, 263, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-264', '流量控制验证不足', '检测流量控制验证不充分的代码', 'security', 'medium', '检查流量控制的验证逻辑是否充分。', '增强流量控制验证逻辑', true, 264, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-265', '限流信息泄露', '检测限流可能泄露信息的代码', 'security', 'high', '检查是否可能通过限流泄露敏感信息。', '防止通过限流泄露信息', true, 265, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-266', '熔断代码质量问题', '检测熔断相关的代码质量问题', 'quality', 'medium', '检查熔断相关的代码质量，如可维护性、可读性等。', '改进熔断代码质量', true, 266, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-267', '缺少降级错误处理', '检测降级错误处理不当的代码', 'quality', 'low', '检查降级相关操作的错误处理是否完善。', '完善降级错误处理', true, 267, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-268', '重试性能问题', '检测重试相关的性能问题', 'quality', 'medium', '检查重试是否存在性能优化空间。', '优化重试性能', true, 268, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-269', '缺少超时文档', '检测超时缺少文档的代码', 'quality', 'low', '检查超时是否有充分的文档说明。', '添加超时文档', true, 269, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-270', '幂等性 - 实现', '检测幂等性相关的实现问题', 'security', 'high', '检查代码中是否存在幂等性相关的实现安全问题。', '修复幂等性相关的实现问题', true, 270, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-271', '一致性配置不当', '检测一致性配置不安全的代码', 'security', 'medium', '检查一致性的配置是否遵循安全最佳实践。', '安全配置一致性', true, 271, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-272', '缺少可用性保护', '检测缺少可用性保护机制的代码', 'security', 'high', '检查是否缺少必要的可用性保护措施。', '添加可用性保护措施', true, 272, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-273', '不安全的分区容错实现', '检测分区容错实现不安全的代码', 'security', 'critical', '检查分区容错的实现是否存在安全漏洞。', '重新安全实现分区容错', true, 273, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-274', 'CAP理论验证不足', '检测CAP理论验证不充分的代码', 'security', 'medium', '检查CAP理论的验证逻辑是否充分。', '增强CAP理论验证逻辑', true, 274, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-275', 'BASE理论信息泄露', '检测BASE理论可能泄露信息的代码', 'security', 'high', '检查是否可能通过BASE理论泄露敏感信息。', '防止通过BASE理论泄露信息', true, 275, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-276', '认证代码质量问题', '检测认证相关的代码质量问题', 'quality', 'medium', '检查认证相关的代码质量，如可维护性、可读性等。', '改进认证代码质量', true, 276, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-277', '缺少授权错误处理', '检测授权错误处理不当的代码', 'quality', 'low', '检查授权相关操作的错误处理是否完善。', '完善授权错误处理', true, 277, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-278', '会话管理性能问题', '检测会话管理相关的性能问题', 'quality', 'medium', '检查会话管理是否存在性能优化空间。', '优化会话管理性能', true, 278, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-279', '缺少输入验证文档', '检测输入验证缺少文档的代码', 'quality', 'low', '检查输入验证是否有充分的文档说明。', '添加输入验证文档', true, 279, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-280', '输出编码 - 审核', '检测输出编码相关的审核问题', 'security', 'high', '检查代码中是否存在输出编码相关的审核安全问题。', '修复输出编码相关的审核问题', true, 280, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第16批 (BATCH-281 ~ BATCH-300)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第16批',
        '批量生成的第16批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        116,
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
SELECT gen_random_uuid(), id, 'BATCH-281', '加密配置不当', '检测加密配置不安全的代码', 'security', 'medium', '检查加密的配置是否遵循安全最佳实践。', '安全配置加密', true, 281, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-282', '缺少密钥管理保护', '检测缺少密钥管理保护机制的代码', 'security', 'high', '检查是否缺少必要的密钥管理保护措施。', '添加密钥管理保护措施', true, 282, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-283', '不安全的错误处理实现', '检测错误处理实现不安全的代码', 'security', 'critical', '检查错误处理的实现是否存在安全漏洞。', '重新安全实现错误处理', true, 283, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-284', '日志记录验证不足', '检测日志记录验证不充分的代码', 'security', 'medium', '检查日志记录的验证逻辑是否充分。', '增强日志记录验证逻辑', true, 284, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-285', '配置管理信息泄露', '检测配置管理可能泄露信息的代码', 'security', 'high', '检查是否可能通过配置管理泄露敏感信息。', '防止通过配置管理泄露信息', true, 285, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-286', '文件操作代码质量问题', '检测文件操作相关的代码质量问题', 'quality', 'medium', '检查文件操作相关的代码质量，如可维护性、可读性等。', '改进文件操作代码质量', true, 286, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-287', '缺少网络通信错误处理', '检测网络通信错误处理不当的代码', 'quality', 'low', '检查网络通信相关操作的错误处理是否完善。', '完善网络通信错误处理', true, 287, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-288', '数据库性能问题', '检测数据库相关的性能问题', 'quality', 'medium', '检查数据库是否存在性能优化空间。', '优化数据库性能', true, 288, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-289', '缺少缓存文档', '检测缓存缺少文档的代码', 'quality', 'low', '检查缓存是否有充分的文档说明。', '添加缓存文档', true, 289, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-290', '队列 - 随机数', '检测队列相关的随机数问题', 'security', 'high', '检查代码中是否存在队列相关的随机数安全问题。', '修复队列相关的随机数问题', true, 290, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-291', '定时任务配置不当', '检测定时任务配置不安全的代码', 'security', 'medium', '检查定时任务的配置是否遵循安全最佳实践。', '安全配置定时任务', true, 291, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-292', '缺少API设计保护', '检测缺少API设计保护机制的代码', 'security', 'high', '检查是否缺少必要的API设计保护措施。', '添加API设计保护措施', true, 292, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-293', '不安全的微服务实现', '检测微服务实现不安全的代码', 'security', 'critical', '检查微服务的实现是否存在安全漏洞。', '重新安全实现微服务', true, 293, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-294', '容器验证不足', '检测容器验证不充分的代码', 'security', 'medium', '检查容器的验证逻辑是否充分。', '增强容器验证逻辑', true, 294, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-295', 'Kubernetes信息泄露', '检测Kubernetes可能泄露信息的代码', 'security', 'high', '检查是否可能通过Kubernetes泄露敏感信息。', '防止通过Kubernetes泄露信息', true, 295, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-296', '云服务代码质量问题', '检测云服务相关的代码质量问题', 'quality', 'medium', '检查云服务相关的代码质量，如可维护性、可读性等。', '改进云服务代码质量', true, 296, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-297', '缺少第三方集成错误处理', '检测第三方集成错误处理不当的代码', 'quality', 'low', '检查第三方集成相关操作的错误处理是否完善。', '完善第三方集成错误处理', true, 297, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-298', '依赖管理性能问题', '检测依赖管理相关的性能问题', 'quality', 'medium', '检查依赖管理是否存在性能优化空间。', '优化依赖管理性能', true, 298, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-299', '缺少补丁管理文档', '检测补丁管理缺少文档的代码', 'quality', 'low', '检查补丁管理是否有充分的文档说明。', '添加补丁管理文档', true, 299, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-300', '变更管理 - 解码', '检测变更管理相关的解码问题', 'security', 'high', '检查代码中是否存在变更管理相关的解码安全问题。', '修复变更管理相关的解码问题', true, 300, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第17批 (BATCH-301 ~ BATCH-320)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第17批',
        '批量生成的第17批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        117,
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
SELECT gen_random_uuid(), id, 'BATCH-301', '发布管理配置不当', '检测发布管理配置不安全的代码', 'security', 'medium', '检查发布管理的配置是否遵循安全最佳实践。', '安全配置发布管理', true, 301, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-302', '缺少监控保护', '检测缺少监控保护机制的代码', 'security', 'high', '检查是否缺少必要的监控保护措施。', '添加监控保护措施', true, 302, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-303', '不安全的告警实现', '检测告警实现不安全的代码', 'security', 'critical', '检查告警的实现是否存在安全漏洞。', '重新安全实现告警', true, 303, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-304', '备份验证不足', '检测备份验证不充分的代码', 'security', 'medium', '检查备份的验证逻辑是否充分。', '增强备份验证逻辑', true, 304, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-305', '恢复信息泄露', '检测恢复可能泄露信息的代码', 'security', 'high', '检查是否可能通过恢复泄露敏感信息。', '防止通过恢复泄露信息', true, 305, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-306', '灾难恢复代码质量问题', '检测灾难恢复相关的代码质量问题', 'quality', 'medium', '检查灾难恢复相关的代码质量，如可维护性、可读性等。', '改进灾难恢复代码质量', true, 306, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-307', '缺少安全测试错误处理', '检测安全测试错误处理不当的代码', 'quality', 'low', '检查安全测试相关操作的错误处理是否完善。', '完善安全测试错误处理', true, 307, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-308', '渗透测试性能问题', '检测渗透测试相关的性能问题', 'quality', 'medium', '检查渗透测试是否存在性能优化空间。', '优化渗透测试性能', true, 308, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-309', '缺少代码审计文档', '检测代码审计缺少文档的代码', 'quality', 'low', '检查代码审计是否有充分的文档说明。', '添加代码审计文档', true, 309, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-310', '静态分析 - 校验', '检测静态分析相关的校验问题', 'security', 'high', '检查代码中是否存在静态分析相关的校验安全问题。', '修复静态分析相关的校验问题', true, 310, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-311', '动态分析配置不当', '检测动态分析配置不安全的代码', 'security', 'medium', '检查动态分析的配置是否遵循安全最佳实践。', '安全配置动态分析', true, 311, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-312', '缺少模糊测试保护', '检测缺少模糊测试保护机制的代码', 'security', 'high', '检查是否缺少必要的模糊测试保护措施。', '添加模糊测试保护措施', true, 312, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-313', '不安全的安全评审实现', '检测安全评审实现不安全的代码', 'security', 'critical', '检查安全评审的实现是否存在安全漏洞。', '重新安全实现安全评审', true, 313, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-314', '威胁建模验证不足', '检测威胁建模验证不充分的代码', 'security', 'medium', '检查威胁建模的验证逻辑是否充分。', '增强威胁建模验证逻辑', true, 314, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-315', '风险评估信息泄露', '检测风险评估可能泄露信息的代码', 'security', 'high', '检查是否可能通过风险评估泄露敏感信息。', '防止通过风险评估泄露信息', true, 315, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-316', '合规性代码质量问题', '检测合规性相关的代码质量问题', 'quality', 'medium', '检查合规性相关的代码质量，如可维护性、可读性等。', '改进合规性代码质量', true, 316, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-317', '缺少隐私保护错误处理', '检测隐私保护错误处理不当的代码', 'quality', 'low', '检查隐私保护相关操作的错误处理是否完善。', '完善隐私保护错误处理', true, 317, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-318', '数据保护性能问题', '检测数据保护相关的性能问题', 'quality', 'medium', '检查数据保护是否存在性能优化空间。', '优化数据保护性能', true, 318, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-319', '缺少数据脱敏文档', '检测数据脱敏缺少文档的代码', 'quality', 'low', '检查数据脱敏是否有充分的文档说明。', '添加数据脱敏文档', true, 319, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-320', '数据分类 - 检测', '检测数据分类相关的检测问题', 'security', 'high', '检查代码中是否存在数据分类相关的检测安全问题。', '修复数据分类相关的检测问题', true, 320, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第18批 (BATCH-321 ~ BATCH-340)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第18批',
        '批量生成的第18批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        118,
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
SELECT gen_random_uuid(), id, 'BATCH-321', '访问控制配置不当', '检测访问控制配置不安全的代码', 'security', 'medium', '检查访问控制的配置是否遵循安全最佳实践。', '安全配置访问控制', true, 321, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-322', '缺少多因素认证保护', '检测缺少多因素认证保护机制的代码', 'security', 'high', '检查是否缺少必要的多因素认证保护措施。', '添加多因素认证保护措施', true, 322, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-323', '不安全的单点登录实现', '检测单点登录实现不安全的代码', 'security', 'critical', '检查单点登录的实现是否存在安全漏洞。', '重新安全实现单点登录', true, 323, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-324', 'OAuth验证不足', '检测OAuth验证不充分的代码', 'security', 'medium', '检查OAuth的验证逻辑是否充分。', '增强OAuth验证逻辑', true, 324, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-325', 'JWT信息泄露', '检测JWT可能泄露信息的代码', 'security', 'high', '检查是否可能通过JWT泄露敏感信息。', '防止通过JWT泄露信息', true, 325, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-326', 'SAML代码质量问题', '检测SAML相关的代码质量问题', 'quality', 'medium', '检查SAML相关的代码质量，如可维护性、可读性等。', '改进SAML代码质量', true, 326, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-327', '缺少证书管理错误处理', '检测证书管理错误处理不当的代码', 'quality', 'low', '检查证书管理相关操作的错误处理是否完善。', '完善证书管理错误处理', true, 327, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-328', 'PKI性能问题', '检测PKI相关的性能问题', 'quality', 'medium', '检查PKI是否存在性能优化空间。', '优化PKI性能', true, 328, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-329', '缺少TLS文档', '检测TLS缺少文档的代码', 'quality', 'low', '检查TLS是否有充分的文档说明。', '添加TLS文档', true, 329, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-330', 'SSL - 加密', '检测SSL相关的加密问题', 'security', 'high', '检查代码中是否存在SSL相关的加密安全问题。', '修复SSL相关的加密问题', true, 330, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-331', 'HTTPS配置不当', '检测HTTPS配置不安全的代码', 'security', 'medium', '检查HTTPS的配置是否遵循安全最佳实践。', '安全配置HTTPS', true, 331, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-332', '缺少WAF保护', '检测缺少WAF保护机制的代码', 'security', 'high', '检查是否缺少必要的WAF保护措施。', '添加WAF保护措施', true, 332, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-333', '不安全的IPS实现', '检测IPS实现不安全的代码', 'security', 'critical', '检查IPS的实现是否存在安全漏洞。', '重新安全实现IPS', true, 333, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-334', 'IDS验证不足', '检测IDS验证不充分的代码', 'security', 'medium', '检查IDS的验证逻辑是否充分。', '增强IDS验证逻辑', true, 334, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-335', '防火墙信息泄露', '检测防火墙可能泄露信息的代码', 'security', 'high', '检查是否可能通过防火墙泄露敏感信息。', '防止通过防火墙泄露信息', true, 335, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-336', '网络分段代码质量问题', '检测网络分段相关的代码质量问题', 'quality', 'medium', '检查网络分段相关的代码质量，如可维护性、可读性等。', '改进网络分段代码质量', true, 336, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-337', '缺少VPN错误处理', '检测VPN错误处理不当的代码', 'quality', 'low', '检查VPN相关操作的错误处理是否完善。', '完善VPN错误处理', true, 337, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-338', '远程访问性能问题', '检测远程访问相关的性能问题', 'quality', 'medium', '检查远程访问是否存在性能优化空间。', '优化远程访问性能', true, 338, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-339', '缺少物理安全文档', '检测物理安全缺少文档的代码', 'quality', 'low', '检查物理安全是否有充分的文档说明。', '添加物理安全文档', true, 339, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-340', '环境安全 - 凭证', '检测环境安全相关的凭证问题', 'security', 'high', '检查代码中是否存在环境安全相关的凭证安全问题。', '修复环境安全相关的凭证问题', true, 340, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第19批 (BATCH-341 ~ BATCH-360)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第19批',
        '批量生成的第19批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        119,
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
SELECT gen_random_uuid(), id, 'BATCH-341', '供应链安全配置不当', '检测供应链安全配置不安全的代码', 'security', 'medium', '检查供应链安全的配置是否遵循安全最佳实践。', '安全配置供应链安全', true, 341, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-342', '缺少开源安全保护', '检测缺少开源安全保护机制的代码', 'security', 'high', '检查是否缺少必要的开源安全保护措施。', '添加开源安全保护措施', true, 342, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-343', '不安全的组件分析实现', '检测组件分析实现不安全的代码', 'security', 'critical', '检查组件分析的实现是否存在安全漏洞。', '重新安全实现组件分析', true, 343, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-344', '漏洞扫描验证不足', '检测漏洞扫描验证不充分的代码', 'security', 'medium', '检查漏洞扫描的验证逻辑是否充分。', '增强漏洞扫描验证逻辑', true, 344, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-345', '补丁管理信息泄露', '检测补丁管理可能泄露信息的代码', 'security', 'high', '检查是否可能通过补丁管理泄露敏感信息。', '防止通过补丁管理泄露信息', true, 345, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-346', '配置核查代码质量问题', '检测配置核查相关的代码质量问题', 'quality', 'medium', '检查配置核查相关的代码质量，如可维护性、可读性等。', '改进配置核查代码质量', true, 346, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-347', '缺少安全编码错误处理', '检测安全编码错误处理不当的代码', 'quality', 'low', '检查安全编码相关操作的错误处理是否完善。', '完善安全编码错误处理', true, 347, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-348', '安全架构性能问题', '检测安全架构相关的性能问题', 'quality', 'medium', '检查安全架构是否存在性能优化空间。', '优化安全架构性能', true, 348, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-349', '缺少安全设计文档', '检测安全设计缺少文档的代码', 'quality', 'low', '检查安全设计是否有充分的文档说明。', '添加安全设计文档', true, 349, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-350', 'DevSecOps - 标准化', '检测DevSecOps相关的标准化问题', 'security', 'high', '检查代码中是否存在DevSecOps相关的标准化安全问题。', '修复DevSecOps相关的标准化问题', true, 350, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-351', 'CI/CD安全配置不当', '检测CI/CD安全配置不安全的代码', 'security', 'medium', '检查CI/CD安全的配置是否遵循安全最佳实践。', '安全配置CI/CD安全', true, 351, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-352', '缺少Git安全保护', '检测缺少Git安全保护机制的代码', 'security', 'high', '检查是否缺少必要的Git安全保护措施。', '添加Git安全保护措施', true, 352, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-353', '不安全的代码库安全实现', '检测代码库安全实现不安全的代码', 'security', 'critical', '检查代码库安全的实现是否存在安全漏洞。', '重新安全实现代码库安全', true, 353, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-354', 'Artifact安全验证不足', '检测Artifact安全验证不充分的代码', 'security', 'medium', '检查Artifact安全的验证逻辑是否充分。', '增强Artifact安全验证逻辑', true, 354, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-355', '容器安全信息泄露', '检测容器安全可能泄露信息的代码', 'security', 'high', '检查是否可能通过容器安全泄露敏感信息。', '防止通过容器安全泄露信息', true, 355, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-356', '镜像安全代码质量问题', '检测镜像安全相关的代码质量问题', 'quality', 'medium', '检查镜像安全相关的代码质量，如可维护性、可读性等。', '改进镜像安全代码质量', true, 356, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-357', '缺少运行时安全错误处理', '检测运行时安全错误处理不当的代码', 'quality', 'low', '检查运行时安全相关操作的错误处理是否完善。', '完善运行时安全错误处理', true, 357, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-358', 'RASP性能问题', '检测RASP相关的性能问题', 'quality', 'medium', '检查RASP是否存在性能优化空间。', '优化RASP性能', true, 358, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-359', '缺少SAST文档', '检测SAST缺少文档的代码', 'quality', 'low', '检查SAST是否有充分的文档说明。', '添加SAST文档', true, 359, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-360', 'DAST - 实现', '检测DAST相关的实现问题', 'security', 'high', '检查代码中是否存在DAST相关的实现安全问题。', '修复DAST相关的实现问题', true, 360, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第20批 (BATCH-361 ~ BATCH-380)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第20批',
        '批量生成的第20批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        120,
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
SELECT gen_random_uuid(), id, 'BATCH-361', 'IAST配置不当', '检测IAST配置不安全的代码', 'security', 'medium', '检查IAST的配置是否遵循安全最佳实践。', '安全配置IAST', true, 361, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-362', '缺少SCA保护', '检测缺少SCA保护机制的代码', 'security', 'high', '检查是否缺少必要的SCA保护措施。', '添加SCA保护措施', true, 362, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-363', '不安全的代码格式实现', '检测代码格式实现不安全的代码', 'security', 'critical', '检查代码格式的实现是否存在安全漏洞。', '重新安全实现代码格式', true, 363, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-364', '命名规范验证不足', '检测命名规范验证不充分的代码', 'security', 'medium', '检查命名规范的验证逻辑是否充分。', '增强命名规范验证逻辑', true, 364, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-365', '注释质量信息泄露', '检测注释质量可能泄露信息的代码', 'security', 'high', '检查是否可能通过注释质量泄露敏感信息。', '防止通过注释质量泄露信息', true, 365, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-366', '函数设计代码质量问题', '检测函数设计相关的代码质量问题', 'quality', 'medium', '检查函数设计相关的代码质量，如可维护性、可读性等。', '改进函数设计代码质量', true, 366, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-367', '缺少类设计错误处理', '检测类设计错误处理不当的代码', 'quality', 'low', '检查类设计相关操作的错误处理是否完善。', '完善类设计错误处理', true, 367, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-368', '模块划分性能问题', '检测模块划分相关的性能问题', 'quality', 'medium', '检查模块划分是否存在性能优化空间。', '优化模块划分性能', true, 368, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-369', '缺少包结构文档', '检测包结构缺少文档的代码', 'quality', 'low', '检查包结构是否有充分的文档说明。', '添加包结构文档', true, 369, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-370', '依赖管理 - 审核', '检测依赖管理相关的审核问题', 'security', 'high', '检查代码中是否存在依赖管理相关的审核安全问题。', '修复依赖管理相关的审核问题', true, 370, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-371', '异常处理配置不当', '检测异常处理配置不安全的代码', 'security', 'medium', '检查异常处理的配置是否遵循安全最佳实践。', '安全配置异常处理', true, 371, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-372', '缺少日志记录保护', '检测缺少日志记录保护机制的代码', 'security', 'high', '检查是否缺少必要的日志记录保护措施。', '添加日志记录保护措施', true, 372, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-373', '不安全的单元测试实现', '检测单元测试实现不安全的代码', 'security', 'critical', '检查单元测试的实现是否存在安全漏洞。', '重新安全实现单元测试', true, 373, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-374', '集成测试验证不足', '检测集成测试验证不充分的代码', 'security', 'medium', '检查集成测试的验证逻辑是否充分。', '增强集成测试验证逻辑', true, 374, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-375', '端到端测试信息泄露', '检测端到端测试可能泄露信息的代码', 'security', 'high', '检查是否可能通过端到端测试泄露敏感信息。', '防止通过端到端测试泄露信息', true, 375, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-376', '测试覆盖代码质量问题', '检测测试覆盖相关的代码质量问题', 'quality', 'medium', '检查测试覆盖相关的代码质量，如可维护性、可读性等。', '改进测试覆盖代码质量', true, 376, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-377', '缺少性能测试错误处理', '检测性能测试错误处理不当的代码', 'quality', 'low', '检查性能测试相关操作的错误处理是否完善。', '完善性能测试错误处理', true, 377, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-378', '压力测试性能问题', '检测压力测试相关的性能问题', 'quality', 'medium', '检查压力测试是否存在性能优化空间。', '优化压力测试性能', true, 378, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-379', '缺少负载测试文档', '检测负载测试缺少文档的代码', 'quality', 'low', '检查负载测试是否有充分的文档说明。', '添加负载测试文档', true, 379, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-380', '代码复用 - 随机数', '检测代码复用相关的随机数问题', 'security', 'high', '检查代码中是否存在代码复用相关的随机数安全问题。', '修复代码复用相关的随机数问题', true, 380, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第21批 (BATCH-381 ~ BATCH-400)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第21批',
        '批量生成的第21批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        121,
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
SELECT gen_random_uuid(), id, 'BATCH-381', '可维护性配置不当', '检测可维护性配置不安全的代码', 'security', 'medium', '检查可维护性的配置是否遵循安全最佳实践。', '安全配置可维护性', true, 381, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-382', '缺少可读性保护', '检测缺少可读性保护机制的代码', 'security', 'high', '检查是否缺少必要的可读性保护措施。', '添加可读性保护措施', true, 382, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-383', '不安全的可扩展性实现', '检测可扩展性实现不安全的代码', 'security', 'critical', '检查可扩展性的实现是否存在安全漏洞。', '重新安全实现可扩展性', true, 383, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-384', '可测试性验证不足', '检测可测试性验证不充分的代码', 'security', 'medium', '检查可测试性的验证逻辑是否充分。', '增强可测试性验证逻辑', true, 384, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-385', '可部署性信息泄露', '检测可部署性可能泄露信息的代码', 'security', 'high', '检查是否可能通过可部署性泄露敏感信息。', '防止通过可部署性泄露信息', true, 385, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-386', '可观测性代码质量问题', '检测可观测性相关的代码质量问题', 'quality', 'medium', '检查可观测性相关的代码质量，如可维护性、可读性等。', '改进可观测性代码质量', true, 386, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-387', '缺少监控错误处理', '检测监控错误处理不当的代码', 'quality', 'low', '检查监控相关操作的错误处理是否完善。', '完善监控错误处理', true, 387, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-388', '告警性能问题', '检测告警相关的性能问题', 'quality', 'medium', '检查告警是否存在性能优化空间。', '优化告警性能', true, 388, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-389', '缺少链路追踪文档', '检测链路追踪缺少文档的代码', 'quality', 'low', '检查链路追踪是否有充分的文档说明。', '添加链路追踪文档', true, 389, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-390', '日志聚合 - 解码', '检测日志聚合相关的解码问题', 'security', 'high', '检查代码中是否存在日志聚合相关的解码安全问题。', '修复日志聚合相关的解码问题', true, 390, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-391', '指标收集配置不当', '检测指标收集配置不安全的代码', 'security', 'medium', '检查指标收集的配置是否遵循安全最佳实践。', '安全配置指标收集', true, 391, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-392', '缺少配置管理保护', '检测缺少配置管理保护机制的代码', 'security', 'high', '检查是否缺少必要的配置管理保护措施。', '添加配置管理保护措施', true, 392, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-393', '不安全的环境管理实现', '检测环境管理实现不安全的代码', 'security', 'critical', '检查环境管理的实现是否存在安全漏洞。', '重新安全实现环境管理', true, 393, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-394', '部署流程验证不足', '检测部署流程验证不充分的代码', 'security', 'medium', '检查部署流程的验证逻辑是否充分。', '增强部署流程验证逻辑', true, 394, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-395', '回滚策略信息泄露', '检测回滚策略可能泄露信息的代码', 'security', 'high', '检查是否可能通过回滚策略泄露敏感信息。', '防止通过回滚策略泄露信息', true, 395, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-396', '蓝绿部署代码质量问题', '检测蓝绿部署相关的代码质量问题', 'quality', 'medium', '检查蓝绿部署相关的代码质量，如可维护性、可读性等。', '改进蓝绿部署代码质量', true, 396, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-397', '缺少金丝雀发布错误处理', '检测金丝雀发布错误处理不当的代码', 'quality', 'low', '检查金丝雀发布相关操作的错误处理是否完善。', '完善金丝雀发布错误处理', true, 397, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-398', 'A/B测试性能问题', '检测A/B测试相关的性能问题', 'quality', 'medium', '检查A/B测试是否存在性能优化空间。', '优化A/B测试性能', true, 398, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-399', '缺少特性开关文档', '检测特性开关缺少文档的代码', 'quality', 'low', '检查特性开关是否有充分的文档说明。', '添加特性开关文档', true, 399, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-400', '配置热更新 - 校验', '检测配置热更新相关的校验问题', 'security', 'high', '检查代码中是否存在配置热更新相关的校验安全问题。', '修复配置热更新相关的校验问题', true, 400, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第22批 (BATCH-401 ~ BATCH-420)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第22批',
        '批量生成的第22批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        122,
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
SELECT gen_random_uuid(), id, 'BATCH-401', '灰度发布配置不当', '检测灰度发布配置不安全的代码', 'security', 'medium', '检查灰度发布的配置是否遵循安全最佳实践。', '安全配置灰度发布', true, 401, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-402', '缺少流量控制保护', '检测缺少流量控制保护机制的代码', 'security', 'high', '检查是否缺少必要的流量控制保护措施。', '添加流量控制保护措施', true, 402, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-403', '不安全的限流实现', '检测限流实现不安全的代码', 'security', 'critical', '检查限流的实现是否存在安全漏洞。', '重新安全实现限流', true, 403, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-404', '熔断验证不足', '检测熔断验证不充分的代码', 'security', 'medium', '检查熔断的验证逻辑是否充分。', '增强熔断验证逻辑', true, 404, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-405', '降级信息泄露', '检测降级可能泄露信息的代码', 'security', 'high', '检查是否可能通过降级泄露敏感信息。', '防止通过降级泄露信息', true, 405, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-406', '重试代码质量问题', '检测重试相关的代码质量问题', 'quality', 'medium', '检查重试相关的代码质量，如可维护性、可读性等。', '改进重试代码质量', true, 406, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-407', '缺少超时错误处理', '检测超时错误处理不当的代码', 'quality', 'low', '检查超时相关操作的错误处理是否完善。', '完善超时错误处理', true, 407, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-408', '幂等性性能问题', '检测幂等性相关的性能问题', 'quality', 'medium', '检查幂等性是否存在性能优化空间。', '优化幂等性性能', true, 408, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-409', '缺少一致性文档', '检测一致性缺少文档的代码', 'quality', 'low', '检查一致性是否有充分的文档说明。', '添加一致性文档', true, 409, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-410', '可用性 - 检测', '检测可用性相关的检测问题', 'security', 'high', '检查代码中是否存在可用性相关的检测安全问题。', '修复可用性相关的检测问题', true, 410, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-411', '分区容错配置不当', '检测分区容错配置不安全的代码', 'security', 'medium', '检查分区容错的配置是否遵循安全最佳实践。', '安全配置分区容错', true, 411, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-412', '缺少CAP理论保护', '检测缺少CAP理论保护机制的代码', 'security', 'high', '检查是否缺少必要的CAP理论保护措施。', '添加CAP理论保护措施', true, 412, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-413', '不安全的BASE理论实现', '检测BASE理论实现不安全的代码', 'security', 'critical', '检查BASE理论的实现是否存在安全漏洞。', '重新安全实现BASE理论', true, 413, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-414', '认证验证不足', '检测认证验证不充分的代码', 'security', 'medium', '检查认证的验证逻辑是否充分。', '增强认证验证逻辑', true, 414, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-415', '授权信息泄露', '检测授权可能泄露信息的代码', 'security', 'high', '检查是否可能通过授权泄露敏感信息。', '防止通过授权泄露信息', true, 415, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-416', '会话管理代码质量问题', '检测会话管理相关的代码质量问题', 'quality', 'medium', '检查会话管理相关的代码质量，如可维护性、可读性等。', '改进会话管理代码质量', true, 416, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-417', '缺少输入验证错误处理', '检测输入验证错误处理不当的代码', 'quality', 'low', '检查输入验证相关操作的错误处理是否完善。', '完善输入验证错误处理', true, 417, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-418', '输出编码性能问题', '检测输出编码相关的性能问题', 'quality', 'medium', '检查输出编码是否存在性能优化空间。', '优化输出编码性能', true, 418, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-419', '缺少加密文档', '检测加密缺少文档的代码', 'quality', 'low', '检查加密是否有充分的文档说明。', '添加加密文档', true, 419, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-420', '密钥管理 - 加密', '检测密钥管理相关的加密问题', 'security', 'high', '检查代码中是否存在密钥管理相关的加密安全问题。', '修复密钥管理相关的加密问题', true, 420, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第23批 (BATCH-421 ~ BATCH-440)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第23批',
        '批量生成的第23批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        123,
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
SELECT gen_random_uuid(), id, 'BATCH-421', '错误处理配置不当', '检测错误处理配置不安全的代码', 'security', 'medium', '检查错误处理的配置是否遵循安全最佳实践。', '安全配置错误处理', true, 421, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-422', '缺少日志记录保护', '检测缺少日志记录保护机制的代码', 'security', 'high', '检查是否缺少必要的日志记录保护措施。', '添加日志记录保护措施', true, 422, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-423', '不安全的配置管理实现', '检测配置管理实现不安全的代码', 'security', 'critical', '检查配置管理的实现是否存在安全漏洞。', '重新安全实现配置管理', true, 423, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-424', '文件操作验证不足', '检测文件操作验证不充分的代码', 'security', 'medium', '检查文件操作的验证逻辑是否充分。', '增强文件操作验证逻辑', true, 424, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-425', '网络通信信息泄露', '检测网络通信可能泄露信息的代码', 'security', 'high', '检查是否可能通过网络通信泄露敏感信息。', '防止通过网络通信泄露信息', true, 425, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-426', '数据库代码质量问题', '检测数据库相关的代码质量问题', 'quality', 'medium', '检查数据库相关的代码质量，如可维护性、可读性等。', '改进数据库代码质量', true, 426, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-427', '缺少缓存错误处理', '检测缓存错误处理不当的代码', 'quality', 'low', '检查缓存相关操作的错误处理是否完善。', '完善缓存错误处理', true, 427, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-428', '队列性能问题', '检测队列相关的性能问题', 'quality', 'medium', '检查队列是否存在性能优化空间。', '优化队列性能', true, 428, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-429', '缺少定时任务文档', '检测定时任务缺少文档的代码', 'quality', 'low', '检查定时任务是否有充分的文档说明。', '添加定时任务文档', true, 429, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-430', 'API设计 - 凭证', '检测API设计相关的凭证问题', 'security', 'high', '检查代码中是否存在API设计相关的凭证安全问题。', '修复API设计相关的凭证问题', true, 430, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-431', '微服务配置不当', '检测微服务配置不安全的代码', 'security', 'medium', '检查微服务的配置是否遵循安全最佳实践。', '安全配置微服务', true, 431, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-432', '缺少容器保护', '检测缺少容器保护机制的代码', 'security', 'high', '检查是否缺少必要的容器保护措施。', '添加容器保护措施', true, 432, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-433', '不安全的Kubernetes实现', '检测Kubernetes实现不安全的代码', 'security', 'critical', '检查Kubernetes的实现是否存在安全漏洞。', '重新安全实现Kubernetes', true, 433, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-434', '云服务验证不足', '检测云服务验证不充分的代码', 'security', 'medium', '检查云服务的验证逻辑是否充分。', '增强云服务验证逻辑', true, 434, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-435', '第三方集成信息泄露', '检测第三方集成可能泄露信息的代码', 'security', 'high', '检查是否可能通过第三方集成泄露敏感信息。', '防止通过第三方集成泄露信息', true, 435, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-436', '依赖管理代码质量问题', '检测依赖管理相关的代码质量问题', 'quality', 'medium', '检查依赖管理相关的代码质量，如可维护性、可读性等。', '改进依赖管理代码质量', true, 436, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-437', '缺少补丁管理错误处理', '检测补丁管理错误处理不当的代码', 'quality', 'low', '检查补丁管理相关操作的错误处理是否完善。', '完善补丁管理错误处理', true, 437, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-438', '变更管理性能问题', '检测变更管理相关的性能问题', 'quality', 'medium', '检查变更管理是否存在性能优化空间。', '优化变更管理性能', true, 438, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-439', '缺少发布管理文档', '检测发布管理缺少文档的代码', 'quality', 'low', '检查发布管理是否有充分的文档说明。', '添加发布管理文档', true, 439, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-440', '监控 - 标准化', '检测监控相关的标准化问题', 'security', 'high', '检查代码中是否存在监控相关的标准化安全问题。', '修复监控相关的标准化问题', true, 440, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第24批 (BATCH-441 ~ BATCH-460)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第24批',
        '批量生成的第24批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        124,
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
SELECT gen_random_uuid(), id, 'BATCH-441', '告警配置不当', '检测告警配置不安全的代码', 'security', 'medium', '检查告警的配置是否遵循安全最佳实践。', '安全配置告警', true, 441, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-442', '缺少备份保护', '检测缺少备份保护机制的代码', 'security', 'high', '检查是否缺少必要的备份保护措施。', '添加备份保护措施', true, 442, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-443', '不安全的恢复实现', '检测恢复实现不安全的代码', 'security', 'critical', '检查恢复的实现是否存在安全漏洞。', '重新安全实现恢复', true, 443, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-444', '灾难恢复验证不足', '检测灾难恢复验证不充分的代码', 'security', 'medium', '检查灾难恢复的验证逻辑是否充分。', '增强灾难恢复验证逻辑', true, 444, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-445', '安全测试信息泄露', '检测安全测试可能泄露信息的代码', 'security', 'high', '检查是否可能通过安全测试泄露敏感信息。', '防止通过安全测试泄露信息', true, 445, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-446', '渗透测试代码质量问题', '检测渗透测试相关的代码质量问题', 'quality', 'medium', '检查渗透测试相关的代码质量，如可维护性、可读性等。', '改进渗透测试代码质量', true, 446, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-447', '缺少代码审计错误处理', '检测代码审计错误处理不当的代码', 'quality', 'low', '检查代码审计相关操作的错误处理是否完善。', '完善代码审计错误处理', true, 447, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-448', '静态分析性能问题', '检测静态分析相关的性能问题', 'quality', 'medium', '检查静态分析是否存在性能优化空间。', '优化静态分析性能', true, 448, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-449', '缺少动态分析文档', '检测动态分析缺少文档的代码', 'quality', 'low', '检查动态分析是否有充分的文档说明。', '添加动态分析文档', true, 449, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-450', '模糊测试 - 实现', '检测模糊测试相关的实现问题', 'security', 'high', '检查代码中是否存在模糊测试相关的实现安全问题。', '修复模糊测试相关的实现问题', true, 450, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-451', '安全评审配置不当', '检测安全评审配置不安全的代码', 'security', 'medium', '检查安全评审的配置是否遵循安全最佳实践。', '安全配置安全评审', true, 451, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-452', '缺少威胁建模保护', '检测缺少威胁建模保护机制的代码', 'security', 'high', '检查是否缺少必要的威胁建模保护措施。', '添加威胁建模保护措施', true, 452, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-453', '不安全的风险评估实现', '检测风险评估实现不安全的代码', 'security', 'critical', '检查风险评估的实现是否存在安全漏洞。', '重新安全实现风险评估', true, 453, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-454', '合规性验证不足', '检测合规性验证不充分的代码', 'security', 'medium', '检查合规性的验证逻辑是否充分。', '增强合规性验证逻辑', true, 454, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-455', '隐私保护信息泄露', '检测隐私保护可能泄露信息的代码', 'security', 'high', '检查是否可能通过隐私保护泄露敏感信息。', '防止通过隐私保护泄露信息', true, 455, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-456', '数据保护代码质量问题', '检测数据保护相关的代码质量问题', 'quality', 'medium', '检查数据保护相关的代码质量，如可维护性、可读性等。', '改进数据保护代码质量', true, 456, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-457', '缺少数据脱敏错误处理', '检测数据脱敏错误处理不当的代码', 'quality', 'low', '检查数据脱敏相关操作的错误处理是否完善。', '完善数据脱敏错误处理', true, 457, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-458', '数据分类性能问题', '检测数据分类相关的性能问题', 'quality', 'medium', '检查数据分类是否存在性能优化空间。', '优化数据分类性能', true, 458, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-459', '缺少访问控制文档', '检测访问控制缺少文档的代码', 'quality', 'low', '检查访问控制是否有充分的文档说明。', '添加访问控制文档', true, 459, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-460', '多因素认证 - 审核', '检测多因素认证相关的审核问题', 'security', 'high', '检查代码中是否存在多因素认证相关的审核安全问题。', '修复多因素认证相关的审核问题', true, 460, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第25批 (BATCH-461 ~ BATCH-480)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第25批',
        '批量生成的第25批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        125,
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
SELECT gen_random_uuid(), id, 'BATCH-461', '单点登录配置不当', '检测单点登录配置不安全的代码', 'security', 'medium', '检查单点登录的配置是否遵循安全最佳实践。', '安全配置单点登录', true, 461, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-462', '缺少OAuth保护', '检测缺少OAuth保护机制的代码', 'security', 'high', '检查是否缺少必要的OAuth保护措施。', '添加OAuth保护措施', true, 462, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-463', '不安全的JWT实现', '检测JWT实现不安全的代码', 'security', 'critical', '检查JWT的实现是否存在安全漏洞。', '重新安全实现JWT', true, 463, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-464', 'SAML验证不足', '检测SAML验证不充分的代码', 'security', 'medium', '检查SAML的验证逻辑是否充分。', '增强SAML验证逻辑', true, 464, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-465', '证书管理信息泄露', '检测证书管理可能泄露信息的代码', 'security', 'high', '检查是否可能通过证书管理泄露敏感信息。', '防止通过证书管理泄露信息', true, 465, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-466', 'PKI代码质量问题', '检测PKI相关的代码质量问题', 'quality', 'medium', '检查PKI相关的代码质量，如可维护性、可读性等。', '改进PKI代码质量', true, 466, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-467', '缺少TLS错误处理', '检测TLS错误处理不当的代码', 'quality', 'low', '检查TLS相关操作的错误处理是否完善。', '完善TLS错误处理', true, 467, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-468', 'SSL性能问题', '检测SSL相关的性能问题', 'quality', 'medium', '检查SSL是否存在性能优化空间。', '优化SSL性能', true, 468, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-469', '缺少HTTPS文档', '检测HTTPS缺少文档的代码', 'quality', 'low', '检查HTTPS是否有充分的文档说明。', '添加HTTPS文档', true, 469, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-470', 'WAF - 随机数', '检测WAF相关的随机数问题', 'security', 'high', '检查代码中是否存在WAF相关的随机数安全问题。', '修复WAF相关的随机数问题', true, 470, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-471', 'IPS配置不当', '检测IPS配置不安全的代码', 'security', 'medium', '检查IPS的配置是否遵循安全最佳实践。', '安全配置IPS', true, 471, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-472', '缺少IDS保护', '检测缺少IDS保护机制的代码', 'security', 'high', '检查是否缺少必要的IDS保护措施。', '添加IDS保护措施', true, 472, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-473', '不安全的防火墙实现', '检测防火墙实现不安全的代码', 'security', 'critical', '检查防火墙的实现是否存在安全漏洞。', '重新安全实现防火墙', true, 473, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-474', '网络分段验证不足', '检测网络分段验证不充分的代码', 'security', 'medium', '检查网络分段的验证逻辑是否充分。', '增强网络分段验证逻辑', true, 474, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-475', 'VPN信息泄露', '检测VPN可能泄露信息的代码', 'security', 'high', '检查是否可能通过VPN泄露敏感信息。', '防止通过VPN泄露信息', true, 475, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-476', '远程访问代码质量问题', '检测远程访问相关的代码质量问题', 'quality', 'medium', '检查远程访问相关的代码质量，如可维护性、可读性等。', '改进远程访问代码质量', true, 476, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-477', '缺少物理安全错误处理', '检测物理安全错误处理不当的代码', 'quality', 'low', '检查物理安全相关操作的错误处理是否完善。', '完善物理安全错误处理', true, 477, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-478', '环境安全性能问题', '检测环境安全相关的性能问题', 'quality', 'medium', '检查环境安全是否存在性能优化空间。', '优化环境安全性能', true, 478, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-479', '缺少供应链安全文档', '检测供应链安全缺少文档的代码', 'quality', 'low', '检查供应链安全是否有充分的文档说明。', '添加供应链安全文档', true, 479, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-480', '开源安全 - 解码', '检测开源安全相关的解码问题', 'security', 'high', '检查代码中是否存在开源安全相关的解码安全问题。', '修复开源安全相关的解码问题', true, 480, NOW(), NOW() FROM new_rule_set;


-- ========================================
-- 第26批 (BATCH-481 ~ BATCH-500)
-- ========================================
WITH new_rule_set AS (
    INSERT INTO audit_rule_sets (
        id, name, description, language, rule_type,
        severity_weights, is_default, is_system,
        is_active, sort_order, created_by, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        '批量规则集 - 第26批',
        '批量生成的第26批20条规则',
        'all',
        'security',
        '{"critical": 10, "high": 5, "medium": 2, "low": 1}',
        false,
        false,
        true,
        126,
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
SELECT gen_random_uuid(), id, 'BATCH-481', '组件分析配置不当', '检测组件分析配置不安全的代码', 'security', 'medium', '检查组件分析的配置是否遵循安全最佳实践。', '安全配置组件分析', true, 481, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-482', '缺少漏洞扫描保护', '检测缺少漏洞扫描保护机制的代码', 'security', 'high', '检查是否缺少必要的漏洞扫描保护措施。', '添加漏洞扫描保护措施', true, 482, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-483', '不安全的补丁管理实现', '检测补丁管理实现不安全的代码', 'security', 'critical', '检查补丁管理的实现是否存在安全漏洞。', '重新安全实现补丁管理', true, 483, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-484', '配置核查验证不足', '检测配置核查验证不充分的代码', 'security', 'medium', '检查配置核查的验证逻辑是否充分。', '增强配置核查验证逻辑', true, 484, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-485', '安全编码信息泄露', '检测安全编码可能泄露信息的代码', 'security', 'high', '检查是否可能通过安全编码泄露敏感信息。', '防止通过安全编码泄露信息', true, 485, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-486', '安全架构代码质量问题', '检测安全架构相关的代码质量问题', 'quality', 'medium', '检查安全架构相关的代码质量，如可维护性、可读性等。', '改进安全架构代码质量', true, 486, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-487', '缺少安全设计错误处理', '检测安全设计错误处理不当的代码', 'quality', 'low', '检查安全设计相关操作的错误处理是否完善。', '完善安全设计错误处理', true, 487, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-488', 'DevSecOps性能问题', '检测DevSecOps相关的性能问题', 'quality', 'medium', '检查DevSecOps是否存在性能优化空间。', '优化DevSecOps性能', true, 488, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-489', '缺少CI/CD安全文档', '检测CI/CD安全缺少文档的代码', 'quality', 'low', '检查CI/CD安全是否有充分的文档说明。', '添加CI/CD安全文档', true, 489, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-490', 'Git安全 - 校验', '检测Git安全相关的校验问题', 'security', 'high', '检查代码中是否存在Git安全相关的校验安全问题。', '修复Git安全相关的校验问题', true, 490, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-491', '代码库安全配置不当', '检测代码库安全配置不安全的代码', 'security', 'medium', '检查代码库安全的配置是否遵循安全最佳实践。', '安全配置代码库安全', true, 491, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-492', '缺少Artifact安全保护', '检测缺少Artifact安全保护机制的代码', 'security', 'high', '检查是否缺少必要的Artifact安全保护措施。', '添加Artifact安全保护措施', true, 492, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-493', '不安全的容器安全实现', '检测容器安全实现不安全的代码', 'security', 'critical', '检查容器安全的实现是否存在安全漏洞。', '重新安全实现容器安全', true, 493, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-494', '镜像安全验证不足', '检测镜像安全验证不充分的代码', 'security', 'medium', '检查镜像安全的验证逻辑是否充分。', '增强镜像安全验证逻辑', true, 494, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-495', '运行时安全信息泄露', '检测运行时安全可能泄露信息的代码', 'security', 'high', '检查是否可能通过运行时安全泄露敏感信息。', '防止通过运行时安全泄露信息', true, 495, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-496', 'RASP代码质量问题', '检测RASP相关的代码质量问题', 'quality', 'medium', '检查RASP相关的代码质量，如可维护性、可读性等。', '改进RASP代码质量', true, 496, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-497', '缺少SAST错误处理', '检测SAST错误处理不当的代码', 'quality', 'low', '检查SAST相关操作的错误处理是否完善。', '完善SAST错误处理', true, 497, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-498', 'DAST性能问题', '检测DAST相关的性能问题', 'quality', 'medium', '检查DAST是否存在性能优化空间。', '优化DAST性能', true, 498, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-499', '缺少IAST文档', '检测IAST缺少文档的代码', 'quality', 'low', '检查IAST是否有充分的文档说明。', '添加IAST文档', true, 499, NOW(), NOW() FROM new_rule_set
UNION ALL SELECT gen_random_uuid(), id, 'BATCH-500', 'SCA - 检测', '检测SCA相关的检测问题', 'security', 'high', '检查代码中是否存在SCA相关的检测安全问题。', '修复SCA相关的检测问题', true, 500, NOW(), NOW() FROM new_rule_set;


-- 查询结果
SELECT '所有批次插入完成！' AS status;
SELECT rs.name, rs.id, COUNT(r.id) AS rules_count
FROM audit_rule_sets rs
LEFT JOIN audit_rules r ON rs.id = r.rule_set_id
WHERE rs.name LIKE '批量规则集%'
GROUP BY rs.name, rs.id
ORDER BY rs.name;
