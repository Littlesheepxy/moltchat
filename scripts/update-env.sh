#!/bin/bash
# ===========================================
# MoltChat .env 一键更新脚本
# 清理已废弃的 Element/OIDC 配置
# ===========================================

set -e

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 找不到 $ENV_FILE"
  echo "用法: ./scripts/update-env.sh [.env路径]"
  exit 1
fi

echo "📋 正在更新 $ENV_FILE ..."

# 1. 备份
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
echo "✅ 已备份到 ${ENV_FILE}.bak.*"

# 2. 删除废弃的变量（逐行过滤）
TEMP_FILE=$(mktemp)
grep -v -E '^\s*(NEXT_PUBLIC_ELEMENT_URL|ELEMENT_WEB_URL|SYNAPSE_OIDC_CLIENT_ID|SYNAPSE_OIDC_CLIENT_SECRET|SYNAPSE_OIDC_REDIRECT_URI)=' "$ENV_FILE" > "$TEMP_FILE" || true

# 3. 删除 OIDC 配置段的注释块
sed -i.tmp '/^# =.*$/{ N; /OIDC Configuration/{ N; N; N; N; d; } }' "$TEMP_FILE" 2>/dev/null || \
sed -i '' '/^# =.*$/{ N; /OIDC Configuration/{ N; N; N; N; d; } }' "$TEMP_FILE"

# 4. 删除包含 "定制版 Element" 的注释行
sed -i.tmp '/定制版 Element/d' "$TEMP_FILE" 2>/dev/null || \
sed -i '' '/定制版 Element/d' "$TEMP_FILE"

# 5. 删除包含 "MoltChat Client" 注释的行（独立注释行）
sed -i.tmp '/^#.*MoltChat Client/d' "$TEMP_FILE" 2>/dev/null || \
sed -i '' '/^#.*MoltChat Client/d' "$TEMP_FILE"

# 6. 清理多余空行（连续3个以上空行合并为2个）
awk 'NF{blank=0} !NF{blank++} blank<=2' "$TEMP_FILE" > "${TEMP_FILE}.clean"
mv "${TEMP_FILE}.clean" "$TEMP_FILE"

# 清理临时 sed 备份
rm -f "${TEMP_FILE}.tmp"

mv "$TEMP_FILE" "$ENV_FILE"

echo ""
echo "🔍 已清理的配置项："
echo "  - NEXT_PUBLIC_ELEMENT_URL  (Element 已移除)"
echo "  - ELEMENT_WEB_URL          (Element 已移除)"
echo "  - SYNAPSE_OIDC_*           (OIDC SSO 已移除)"
echo ""

# 7. 验证关键配置是否存在
echo "📊 当前关键配置检查："
check_var() {
  local var_name=$1
  local val=$(grep -E "^${var_name}=" "$ENV_FILE" | head -1 | cut -d= -f2-)
  if [ -n "$val" ]; then
    # 隐藏敏感值
    case "$var_name" in
      *SECRET*|*TOKEN*|*PASSWORD*|DATABASE_URL)
        echo "  ✅ $var_name = ${val:0:8}..."
        ;;
      *)
        echo "  ✅ $var_name = $val"
        ;;
    esac
  else
    echo "  ⚠️  $var_name 未设置"
  fi
}

check_var "DATABASE_URL"
check_var "GATEWAY_PORT"
check_var "JWT_SECRET"
check_var "NEXT_PUBLIC_GATEWAY_URL"
check_var "NEXT_PUBLIC_APP_URL"
check_var "MATRIX_ENABLED"
check_var "MATRIX_HOMESERVER_URL"
check_var "MATRIX_BOT_USER_ID"
check_var "MATRIX_BOT_ACCESS_TOKEN"
check_var "MATRIX_SERVER_NAME"
check_var "TWITTER_CLIENT_ID"
check_var "TWITTER_CLIENT_SECRET"
check_var "BETTER_AUTH_SECRET"
check_var "NODE_ENV"

echo ""
echo "✅ .env 更新完成！"
echo ""
echo "⚡ 下一步："
echo "  1. 检查 .env 内容: cat $ENV_FILE"
echo "  2. 重新部署: docker compose -f docker-compose.prod.yml up -d --build"
