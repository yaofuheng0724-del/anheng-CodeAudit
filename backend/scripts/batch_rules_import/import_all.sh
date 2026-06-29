#!/bin/bash
#
# DeepAudit 批量规则导入脚本 (480条规则，24个规则集)
#
# 使用方法：
#   1. 确保 DeepAudit 后端已启动
#   2. chmod +x import_all.sh
#   3. ./import_all.sh
#
# 脚本会提示输入用户名和密码，自动登录后批量导入。
# 也可以通过环境变量预设：
#   export DEEPAUDIT_API_URL=http://localhost:8000
#   export DEEPAUDIT_USERNAME=admin
#   export DEEPAUDIT_PASSWORD=Admin@123456
#   ./import_all.sh
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${DEEPAUDIT_API_URL:-http://localhost:8000}"

echo "╔══════════════════════════════════════════╗"
echo "║   DeepAudit 批量规则导入工具              ║"
echo "║   共 24 个规则集，480 条规则              ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "🎯 目标服务: $BASE_URL"
echo ""

# ── 登录获取 token ──
USERNAME="${DEEPAUDIT_USERNAME:-}"
PASSWORD="${DEEPAUDIT_PASSWORD:-}"

if [ -z "$USERNAME" ]; then
    read -rp "请输入用户名: " USERNAME
fi
if [ -z "$PASSWORD" ]; then
    read -rp "请输入密码: " -s PASSWORD
    echo ""
fi

echo "🔐 正在登录..."
LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST \
  "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$USERNAME&password=$PASSWORD")

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESP" | sed '$d')

if [ "$LOGIN_HTTP_CODE" != "200" ]; then
    echo "❌ 登录失败 (HTTP $LOGIN_HTTP_CODE)"
    echo "   响应: $LOGIN_BODY"
    exit 1
fi

TOKEN=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ 无法解析 token，登录响应: $LOGIN_BODY"
    exit 1
fi

echo "✅ 登录成功！"
echo ""

# ── 检查服务可用性 ──
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$HEALTH" != "200" ]; then
    echo "⚠️  服务健康检查异常 (HTTP $HEALTH)，继续尝试导入..."
fi

# ── 批量导入 ──
SUCCESS=0
FAIL=0
TOTAL_RULES=0

JSON_DIR="$SCRIPT_DIR/batch_rules_individual"

if [ ! -d "$JSON_DIR" ]; then
    echo "❌ 找不到规则数据目录: $JSON_DIR"
    echo "   请确保 batch_rules_individual/ 目录与此脚本在同一目录下"
    exit 1
fi

JSON_COUNT=$(ls -1 "$JSON_DIR"/batch_*.json 2>/dev/null | wc -l)
if [ "$JSON_COUNT" -eq 0 ]; then
    echo "❌ 规则数据目录中没有 JSON 文件: $JSON_DIR"
    exit 1
fi

echo "📦 开始导入 $JSON_COUNT 个规则集..."
echo ""

for json_file in "$JSON_DIR"/batch_*.json; do
    # 提取批次名
    BATCH_NAME=$(python3 -c "import sys,json; print(json.load(open('$json_file'))['name'])" 2>/dev/null)
    RULE_COUNT=$(python3 -c "import sys,json; print(len(json.load(open('$json_file'))['rules']))" 2>/dev/null)

    if [ -z "$BATCH_NAME" ]; then
        echo "⚠️  跳过无效文件: $(basename "$json_file")"
        continue
    fi

    echo -n "📥 导入: $BATCH_NAME ($RULE_COUNT 条)... "

    RESP=$(curl -s -w "\n%{http_code}" -X POST \
      "$BASE_URL/api/v1/rules/import" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d @"$json_file")

    HTTP_CODE=$(echo "$RESP" | tail -1)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo "✅"
        SUCCESS=$((SUCCESS + 1))
        TOTAL_RULES=$((TOTAL_RULES + RULE_COUNT))
    else
        BODY=$(echo "$RESP" | sed '$d')
        echo "❌ (HTTP $HTTP_CODE)"
        echo "   响应: $(echo "$BODY" | head -c 200)"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "========================================"
echo "🎉 导入完成！"
echo "   成功: $SUCCESS 个规则集 ($TOTAL_RULES 条规则)"
if [ "$FAIL" -gt 0 ]; then
    echo "   失败: $FAIL 个规则集"
fi
echo "========================================"
