from app.services.init_templates import SYSTEM_RULE_SETS


def test_iac_rule_sets_present():
    iac_sets = [rs for rs in SYSTEM_RULE_SETS if rs["rule_type"] == "iac"]
    names = sorted(rs["name"] for rs in iac_sets)
    assert names == ["IaC规则-CI/CD类", "IaC规则-容器镜像类", "IaC规则-编排部署类"]
    total_rules = sum(len(rs["rules"]) for rs in iac_sets)
    assert total_rules == 10


def test_iac_rule_codes_are_unique():
    iac_sets = [rs for rs in SYSTEM_RULE_SETS if rs["rule_type"] == "iac"]
    codes = [r["rule_code"] for rs in iac_sets for r in rs["rules"]]
    assert len(codes) == len(set(codes)) == 10
