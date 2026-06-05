-- 根据规则内容主题重新命名通用规则集

-- 第1批：基础安全规则
UPDATE audit_rule_sets SET name = '通用规则集 - 基础安全' WHERE name = '通用规则集 - 第1批';

-- 第2批：数据安全
UPDATE audit_rule_sets SET name = '通用规则集 - 数据安全' WHERE name = '通用规则集 - 第2批';

-- 第3批：Web安全
UPDATE audit_rule_sets SET name = '通用规则集 - Web安全' WHERE name = '通用规则集 - 第3批';

-- 第4批：API与资源安全
UPDATE audit_rule_sets SET name = '通用规则集 - API安全' WHERE name = '通用规则集 - 第4批';

-- 第5批：前端安全
UPDATE audit_rule_sets SET name = '通用规则集 - 前端安全' WHERE name = '通用规则集 - 第5批';

-- 第6批：密码学安全
UPDATE audit_rule_sets SET name = '通用规则集 - 密码学安全' WHERE name = '通用规则集 - 第6批';

-- 第7批：测试与代码质量
UPDATE audit_rule_sets SET name = '通用规则集 - 代码质量' WHERE name = '通用规则集 - 第7批';

-- 第8批：部署与发布
UPDATE audit_rule_sets SET name = '通用规则集 - 发布管理' WHERE name = '通用规则集 - 第8批';

-- 第9批：输入输出安全
UPDATE audit_rule_sets SET name = '通用规则集 - 输入输出安全' WHERE name = '通用规则集 - 第9批';

-- 第10批：运维安全
UPDATE audit_rule_sets SET name = '通用规则集 - 运维安全' WHERE name = '通用规则集 - 第10批';

-- 第11批：访问控制安全
UPDATE audit_rule_sets SET name = '通用规则集 - 访问控制' WHERE name = '通用规则集 - 第11批';

-- 第12批：供应链安全
UPDATE audit_rule_sets SET name = '通用规则集 - 供应链安全' WHERE name = '通用规则集 - 第12批';

-- 第13批：安全测试工具
UPDATE audit_rule_sets SET name = '通用规则集 - 安全测试' WHERE name = '通用规则集 - 第13批';

-- 第14批：代码质量
UPDATE audit_rule_sets SET name = '通用规则集 - 代码质量-高级' WHERE name = '通用规则集 - 第14批';

-- 第15批：流量管理
UPDATE audit_rule_sets SET name = '通用规则集 - 流量管理' WHERE name = '通用规则集 - 第15批';

-- 第16批：密钥与配置
UPDATE audit_rule_sets SET name = '通用规则集 - 密钥配置' WHERE name = '通用规则集 - 第16批';

-- 第17批：备份恢复
UPDATE audit_rule_sets SET name = '通用规则集 - 备份恢复' WHERE name = '通用规则集 - 第17批';

-- 第18批：认证安全
UPDATE audit_rule_sets SET name = '通用规则集 - 认证安全' WHERE name = '通用规则集 - 第18批';

-- 第19批：漏洞管理
UPDATE audit_rule_sets SET name = '通用规则集 - 漏洞管理' WHERE name = '通用规则集 - 第19批';

-- 第20批：代码规范
UPDATE audit_rule_sets SET name = '通用规则集 - 代码规范' WHERE name = '通用规则集 - 第20批';

-- 第21批：代码可维护性
UPDATE audit_rule_sets SET name = '通用规则集 - 可维护性' WHERE name = '通用规则集 - 第21批';

-- 第22批：熔断降级
UPDATE audit_rule_sets SET name = '通用规则集 - 熔断降级' WHERE name = '通用规则集 - 第22批';

-- 第23批：配置与日志
UPDATE audit_rule_sets SET name = '通用规则集 - 配置日志' WHERE name = '通用规则集 - 第23批';

-- 第24批：灾难恢复
UPDATE audit_rule_sets SET name = '通用规则集 - 灾难恢复' WHERE name = '通用规则集 - 第24批';

-- 第25批：认证协议
UPDATE audit_rule_sets SET name = '通用规则集 - 认证协议' WHERE name = '通用规则集 - 第25批';

-- 第26批：安全编码
UPDATE audit_rule_sets SET name = '通用规则集 - 安全编码' WHERE name = '通用规则集 - 第26批';

-- 验证重命名结果
SELECT name FROM audit_rule_sets WHERE name LIKE '通用规则集%' ORDER BY name;
