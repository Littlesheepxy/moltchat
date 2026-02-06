#!/bin/bash

# Test: Agent Handles Validation Failures
# 测试 Agent 如何处理验证失败并继续收集

set -e

echo "=========================================="
echo "  测试：验证失败场景"
echo "=========================================="
echo ""

AGENT_ID="b826b315-c879-4dbf-aff8-e655aba64dbd"

# ============================================
# 场景 1: bio 太短（只有 20 字符，要求 50）
# ============================================
echo "=== 场景 1: bio 太短 ==="
echo ""
echo "Agent: 请介绍一下你的背景..."
echo ""
echo "Owner: I am an AI researcher"
echo "       (只有 23 字符)"
echo ""
echo "Agent: 正在保存..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "I am an AI researcher"
  }')

echo ""
if echo "$RESULT" | jq -e '.success == false' > /dev/null; then
  echo "❌ 验证失败（符合预期）"
  echo ""
  echo "错误信息:"
  echo "$RESULT" | jq '.error'
  echo ""
  echo "Agent 看到的详细错误:"
  echo "$RESULT" | jq '.error.data.validation_errors // empty'
  echo ""
  echo "Agent: 哦，太短了！我看到错误提示说需要至少 50 字符。"
  echo "       能再详细介绍一下吗？至少 50 字..."
else
  echo "⚠️  验证应该失败但通过了"
fi

echo ""
echo "---"
echo ""

# ============================================
# 场景 2: topics 不够（只有 2 个，要求 3）
# ============================================
echo "=== 场景 2: topics 不够 ==="
echo ""
echo "Agent: 请告诉我你感兴趣的话题..."
echo ""
echo "Owner: AI 和 Machine Learning"
echo "       (只有 2 个)"
echo ""
echo "Agent: 正在保存..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "topics": ["AI", "Machine Learning"]
  }')

echo ""
if echo "$RESULT" | jq -e '.success == false' > /dev/null; then
  echo "❌ 验证失败（符合预期）"
  echo ""
  echo "错误信息:"
  echo "$RESULT" | jq '.error'
  echo ""
  echo "Agent: 我看到至少需要 3 个话题。能再加 1-2 个吗？"
else
  echo "⚠️  验证应该失败但通过了"
fi

echo ""
echo "---"
echo ""

# ============================================
# 场景 3: 无效的 industry
# ============================================
echo "=== 场景 3: 无效的行业 ==="
echo ""
echo "Agent: 你在哪个行业工作？"
echo ""
echo "Owner: Blockchain"
echo "       (不在预设列表中)"
echo ""
echo "Agent: 正在保存..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "industry": "Blockchain"
  }')

echo ""
if echo "$RESULT" | jq -e '.success == false' > /dev/null; then
  echo "❌ 验证失败（符合预期）"
  echo ""
  echo "错误信息:"
  echo "$RESULT" | jq '.error'
  echo ""
  echo "Agent: 这个行业不在系统列表中。请从以下选项选择："
  echo "       - AI/Machine Learning"
  echo "       - Software Development"
  echo "       - Consulting"
  echo "       - Other"
else
  echo "⚠️  验证应该失败但通过了"
fi

echo ""
echo "---"
echo ""

# ============================================
# 场景 4: job_title 太短（只有 3 字符，要求 5）
# ============================================
echo "=== 场景 4: job_title 太短 ==="
echo ""
echo "Agent: 你的职位是什么？"
echo ""
echo "Owner: CEO"
echo "       (只有 3 字符)"
echo ""
echo "Agent: 正在保存..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "CEO"
  }')

echo ""
if echo "$RESULT" | jq -e '.success == false' > /dev/null; then
  echo "❌ 验证失败（符合预期）"
  echo ""
  echo "错误信息:"
  echo "$RESULT" | jq '.error'
  echo ""
  echo "Agent: 职位需要至少 5 个字符。能更具体一些吗？"
  echo "       比如 'CEO & Founder' 或 'Chief Executive Officer'"
else
  echo "⚠️  验证应该失败但通过了"
fi

echo ""
echo "---"
echo ""

# ============================================
# 场景 5: Agent 根据错误反馈重新收集
# ============================================
echo "=== 场景 5: Agent 根据错误重新收集（完整流程） ==="
echo ""

echo "1️⃣ 第一次尝试（bio 太短）"
echo ""
echo "Owner: I work in AI"
echo ""

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"bio": "I work in AI"}')

if echo "$RESULT" | jq -e '.success == false' > /dev/null; then
  ERROR_MSG=$(echo "$RESULT" | jq -r '.error.message')
  echo "❌ 失败: $ERROR_MSG"
  echo ""
  echo "Agent: 抱歉，需要至少 50 字符。能详细介绍一下吗？"
  echo "       包括你的经验年限、专长领域、主要工作等..."
else
  echo "✓ 成功（意外）"
fi

echo ""
echo "2️⃣ 第二次尝试（根据反馈补充）"
echo ""
echo "Owner: I work in AI research with 8+ years of experience in"
echo "       machine learning, NLP, and AI safety. I focus on"
echo "       constitutional AI and RLHF."
echo ""

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "I work in AI research with 8+ years of experience in machine learning, natural language processing, and AI safety. My focus areas include constitutional AI and RLHF."
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null; then
  RATE=$(echo "$RESULT" | jq -r '.data.completion.rate')
  echo "✅ 成功！完成度: ${RATE}%"
  echo ""
  echo "Agent: 太好了！信息已保存。"
else
  echo "❌ 仍然失败"
  echo "$RESULT" | jq .
fi

echo ""
echo "---"
echo ""

# ============================================
# 场景 6: 批量更新时的部分失败
# ============================================
echo "=== 场景 6: 批量更新时的验证 ==="
echo ""
echo "Agent: 我收集了多个信息，一起保存..."
echo ""
echo "Data: {
  \"display_name\": \"Sarah\",           ✓ (有效)
  \"industry\": \"AI/Machine Learning\",  ✓ (有效)
  \"job_title\": \"SE\",                  ✗ (太短，只有 2 字符)
  \"topics\": [\"AI\"]                     ✗ (只有 1 个，需要 3 个)
}"
echo ""

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Sarah",
    "industry": "AI/Machine Learning",
    "job_title": "SE",
    "topics": ["AI"]
  }')

if echo "$RESULT" | jq -e '.success == false' > /dev/null; then
  echo "❌ 验证失败"
  echo ""
  echo "失败的字段:"
  echo "$RESULT" | jq '.error.data.validation_errors // .error'
  echo ""
  echo "Agent: 我看到 2 个问题："
  echo "       1. job_title 需要至少 5 字符（当前: 2）"
  echo "       2. topics 需要至少 3 个（当前: 1）"
  echo ""
  echo "       让我重新询问这两个信息..."
else
  echo "✓ 成功"
fi

echo ""
echo "=========================================="
echo "  测试完成"
echo "=========================================="
echo ""

echo "📊 总结："
echo ""
echo "✅ Agent 可以从错误响应中获得："
echo "   1. 具体哪个字段验证失败"
echo "   2. 当前值和最低要求"
echo "   3. 清晰的错误描述"
echo ""
echo "✅ Agent 可以基于错误："
echo "   1. 重新询问用户"
echo "   2. 提供更具体的指引"
echo "   3. 继续收集直到满足要求"
echo ""
echo "✅ 用户体验："
echo "   1. 不会丢失已输入的信息"
echo "   2. 获得明确的改进方向"
echo "   3. 可以逐步完善资料"
