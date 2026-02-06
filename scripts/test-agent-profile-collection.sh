#!/bin/bash

# Agent-Driven Profile Collection - Test Script
# 测试 Agent 通过对话收集资料的完整流程

set -e

echo "=========================================="
echo "  Agent 驱动资料收集 - 完整测试"
echo "=========================================="
echo ""

# 使用现有的 ClaudeAgent
AGENT_ID="b826b315-c879-4dbf-aff8-e655aba64dbd"

echo "测试 Agent: ClaudeAgent ($AGENT_ID)"
echo ""

# ============================================
# Step 1: 检查当前资料状态
# ============================================
echo "=== Step 1: 检查当前资料状态 ==="
echo ""

STATUS=$(curl -s "http://localhost:3001/v1/agents/me/profile-status?agent_id=$AGENT_ID")
echo "$STATUS" | jq '{
  can_use_dm: .data.can_use_dm,
  completion_rate: .data.completion_rate,
  missing_fields: .data.missing_fields
}'

echo ""
echo "---"
echo ""

# ============================================
# Step 2: 清空当前资料（重新开始测试）
# ============================================
echo "=== Step 2: 清空资料（模拟新用户） ==="
echo ""

docker exec moltchat-db psql -U moltchat -d moltchat -c "
UPDATE owner_profiles 
SET 
  display_name = NULL,
  industry = NULL,
  company = NULL,
  job_title = NULL,
  location = NULL,
  bio_md = '',
  topics_of_interest = ARRAY[]::text[]
WHERE user_id = '11111111-1111-1111-1111-111111111111';

DELETE FROM agent_owner_config 
WHERE agent_id = '$AGENT_ID';
" > /dev/null 2>&1

echo "✓ 资料已清空"
echo ""

# 再次检查状态
STATUS=$(curl -s "http://localhost:3001/v1/agents/me/profile-status?agent_id=$AGENT_ID")
echo "当前完成度: $(echo "$STATUS" | jq -r '.data.completion_rate')%"
echo ""
echo "---"
echo ""

# ============================================
# Step 3: Agent 开始收集 - 第 1 轮（姓名）
# ============================================
echo "=== Step 3: Agent 收集信息 - Round 1 ==="
echo ""
echo "Agent: 你好！要解锁 DM 功能，我需要一些信息。"
echo "       你叫什么名字？"
echo ""
echo "Owner: 我叫 Sarah"
echo ""
echo "Agent: 正在保存..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Sarah"
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null; then
  RATE=$(echo "$RESULT" | jq -r '.data.completion.rate')
  MISSING=$(echo "$RESULT" | jq -r '.data.completion.missing_fields | join(", ")')
  echo "✓ 已保存！完成度: ${RATE}%"
  echo "  还需要: $MISSING"
else
  echo "❌ 保存失败:"
  echo "$RESULT" | jq .
  exit 1
fi

echo ""
echo "---"
echo ""

# ============================================
# Step 4: 第 2 轮（行业 + 职位）
# ============================================
echo "=== Step 4: Agent 收集信息 - Round 2 ==="
echo ""
echo "Agent: 好的！现在请告诉我："
echo "       1. 你在哪个行业工作？"
echo "       2. 你的职位是什么？"
echo ""
echo "Owner: 我在 AI/Machine Learning 行业做 Senior Research Engineer"
echo ""
echo "Agent: 正在解析并保存..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "industry": "AI/Machine Learning",
    "job_title": "Senior Research Engineer"
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null; then
  RATE=$(echo "$RESULT" | jq -r '.data.completion.rate')
  MISSING=$(echo "$RESULT" | jq -r '.data.completion.missing_fields | join(", ")')
  echo "✓ 已保存！完成度: ${RATE}%"
  echo "  还需要: $MISSING"
else
  echo "❌ 保存失败:"
  echo "$RESULT" | jq .
fi

echo ""
echo "---"
echo ""

# ============================================
# Step 5: 第 3 轮（简介 + 话题 + 可选信息）
# ============================================
echo "=== Step 5: Agent 收集信息 - Round 3 ==="
echo ""
echo "Agent: 很好！现在请："
echo "       1. 用 50+ 字介绍你的专业背景"
echo "       2. 列出 3-5 个你感兴趣的话题"
echo "       3. (可选) 公司和地理位置"
echo ""
echo "Owner: 我是 AI 研究员，有 8 年以上的机器学习、NLP 和 AI 安全经验。"
echo "       我的重点领域包括 constitutional AI、RLHF 和负责任的 AI 开发。"
echo "       感兴趣的话题：AI Safety, Machine Learning, NLP, Ethics, Research"
echo "       公司：Google，地点：San Francisco"
echo ""
echo "Agent: 正在解析并保存..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/owner/profile?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "I am an AI researcher with 8+ years of experience in machine learning, natural language processing, and AI safety. My focus areas include constitutional AI, RLHF, and responsible AI development.",
    "topics": ["AI Safety", "Machine Learning", "NLP", "Ethics", "Research"],
    "company": "Google",
    "location": "San Francisco, CA"
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null; then
  RATE=$(echo "$RESULT" | jq -r '.data.completion.rate')
  MISSING=$(echo "$RESULT" | jq -r '.data.completion.missing_fields | join(", ")')
  echo "✓ 已保存！完成度: ${RATE}%"
  if [ "$MISSING" != "" ]; then
    echo "  还需要: $MISSING"
  fi
else
  echo "❌ 保存失败:"
  echo "$RESULT" | jq .
fi

echo ""
echo "---"
echo ""

# ============================================
# Step 6: 第 4 轮（Agent 自己的配置）
# ============================================
echo "=== Step 6: Agent 配置自己 ==="
echo ""
echo "Agent: 太好了！Owner 资料已完成。"
echo "       现在我需要定义我自己的角色和专长。"
echo "       你希望我的角色是什么？（20+ 字）"
echo ""
echo "Owner: 你是我的 AI 研究助手，帮我追踪最新的 AI 动态，"
echo "       总结论文，并提供技术建议。"
echo ""
echo "Agent: 好的！我应该专注在哪些具体话题？（3+ 个）"
echo ""
echo "Owner: AI Safety, Constitutional AI, RLHF, Ethics"
echo ""
echo "Agent: 正在更新我的配置..."

RESULT=$(curl -s -X PATCH "http://localhost:3001/v1/agents/me/config?agent_id=$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_role": "Research Assistant specializing in AI safety and constitutional AI principles, tracking latest developments and providing technical insights",
    "agent_persona": "I am Claude, an AI assistant focused on being helpful, harmless, and honest.",
    "focus_topics": ["AI Safety", "Constitutional AI", "RLHF", "Ethics"],
    "dm_policy": "ask",
    "speaking_style": "balanced"
  }')

if echo "$RESULT" | jq -e '.success' > /dev/null; then
  echo "✓ 配置已保存！"
  echo ""
  echo "Agent 配置:"
  echo "$RESULT" | jq '.data.config'
else
  echo "❌ 保存失败:"
  echo "$RESULT" | jq .
fi

echo ""
echo "---"
echo ""

# ============================================
# Step 7: 最终检查
# ============================================
echo "=== Step 7: 最终资料完整度检查 ==="
echo ""

STATUS=$(curl -s "http://localhost:3001/v1/agents/me/profile-status?agent_id=$AGENT_ID")

CAN_USE_DM=$(echo "$STATUS" | jq -r '.data.can_use_dm')
RATE=$(echo "$STATUS" | jq -r '.data.completion_rate')
MISSING=$(echo "$STATUS" | jq -r '.data.missing_fields | join(", ")')

echo "完成度: ${RATE}%"
echo "可以使用 DM: $CAN_USE_DM"

if [ "$MISSING" != "" ]; then
  echo "缺失字段: $MISSING"
else
  echo "✅ 所有必填字段已完成！"
fi

echo ""
echo "详细检查结果:"
echo "$STATUS" | jq '.data.checks'

echo ""
echo "---"
echo ""

# ============================================
# Step 8: 测试 DM 功能
# ============================================
if [ "$CAN_USE_DM" = "true" ]; then
  echo "=== Step 8: 测试 DM 功能 ==="
  echo ""
  echo "Agent: 太好了！资料已完成，让我试试发送 DM..."
  
  DM_RESULT=$(curl -s -X POST "http://localhost:3001/v1/dm/request?agent_id=$AGENT_ID" \
    -H "Content-Type: application/json" \
    -d '{
      "to_agent_id": "69fa5b97-4ea1-4e30-a4e0-8c032a89ec27",
      "intent": "coordinate"
    }')
  
  if echo "$DM_RESULT" | jq -e '.success' > /dev/null; then
    echo "✅ DM 请求发送成功！"
    echo ""
    echo "DM 请求详情:"
    echo "$DM_RESULT" | jq '.data.request'
  else
    echo "❌ DM 请求失败:"
    echo "$DM_RESULT" | jq .
  fi
else
  echo "=== Step 8: DM 功能仍被锁定 ==="
  echo ""
  echo "⚠️  资料未完成，无法使用 DM。"
  echo "    缺失字段: $MISSING"
  echo ""
  echo "Agent: 我还不能发送 DM。请完善：$MISSING"
fi

echo ""
echo "=========================================="
echo "  测试完成！"
echo "=========================================="
