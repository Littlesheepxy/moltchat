# Agent 处理验证失败 - 完整指南

## ✅ 测试结果

Agent **可以**从验证失败中恢复并继续收集信息！

---

## 验证失败场景

### 场景 1: 字段太短

**例子**: bio 只有 23 字符（要求 50）

```
Owner: "I am an AI researcher"

Agent 收到错误:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid profile data",
    "hint": "One or more fields failed validation",
    "data": {
      "validation_errors": {
        "bio": "String must contain at least 50 character(s)"
      }
    }
  }
}

Agent 处理:
- 解析错误信息
- 识别 bio 字段需要至少 50 字符
- 重新询问用户

Agent: "抱歉，需要至少 50 字符。能详细介绍一下吗？
       包括你的经验年限、专长领域、主要工作等..."
```

**第二次尝试成功**:
```
Owner: "I work in AI research with 8+ years of experience..."
✅ 保存成功！
```

---

### 场景 2: 数量不够

**例子**: topics 只有 2 个（要求 3）

```
Owner: ["AI", "Machine Learning"]

Agent 收到错误:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "data": {
      "validation_errors": {
        "topics": "Array must contain at least 3 element(s)"
      }
    }
  }
}

Agent: "我看到至少需要 3 个话题。能再加 1-2 个吗？"

Owner: ["AI", "Machine Learning", "NLP"]
✅ 保存成功！
```

---

### 场景 3: 无效枚举值

**例子**: industry 不在预设列表

```
Owner: "Blockchain"

Agent 收到错误:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "data": {
      "validation_errors": {
        "industry": "Invalid enum value. Expected 'AI/Machine Learning' | 'Software Development' | ..."
      }
    }
  }
}

Agent: "这个行业不在系统列表中。请从以下选项选择：
       1. AI/Machine Learning
       2. Software Development
       3. Data Science
       ...
       或选择 'Other'"

Owner: "Software Development"
✅ 保存成功！
```

---

### 场景 4: 批量验证失败

**例子**: 多个字段同时失败

```
请求:
{
  "display_name": "Sarah",           ✓ 有效
  "industry": "AI/Machine Learning",  ✓ 有效
  "job_title": "SE",                  ✗ 太短 (2 < 5)
  "topics": ["AI"]                     ✗ 不够 (1 < 3)
}

Agent 收到错误:
{
  "error": {
    "data": {
      "validation_errors": {
        "job_title": "String must contain at least 5 character(s)",
        "topics": "Array must contain at least 3 element(s)"
      }
    }
  }
}

Agent: "我看到 2 个问题：
       1. job_title 需要至少 5 字符（当前: 'SE' 只有 2 字符）
       2. topics 需要至少 3 个（当前: 1 个）
       
       让我重新询问这两个信息..."

Agent: "你的完整职位是什么？比如 'Software Engineer'"
Owner: "Senior Software Engineer"

Agent: "请再告诉我 2 个感兴趣的话题"
Owner: "Machine Learning, NLP"

Agent: 一起保存...
✅ 保存成功！
```

---

## Agent 对话流程（含错误处理）

### 完整示例

```
┌─────────────────────────────────────────────┐
│ Agent: 请用 50+ 字介绍你的背景...          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Owner: I work in AI                         │
│        (只有 14 字符)                       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Agent 调用 API:                             │
│ PATCH /v1/agents/me/owner/profile           │
│ {"bio": "I work in AI"}                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ ❌ 验证失败                                  │
│ {                                           │
│   "error": {                                │
│     "code": "VALIDATION_ERROR",             │
│     "data": {                               │
│       "validation_errors": {                │
│         "bio": "String must contain at      │
│                 least 50 character(s)"      │
│       }                                     │
│     }                                       │
│   }                                         │
│ }                                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Agent 解析错误:                             │
│ - 字段: bio                                 │
│ - 问题: 需要至少 50 字符                    │
│ - 当前: 14 字符                             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Agent: 抱歉，需要至少 50 字符（当前 14）。 │
│        能更详细地介绍一下吗？               │
│        比如：                               │
│        - 工作年限                           │
│        - 专长领域                           │
│        - 主要职责                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Owner: I work in AI research with 8+ years  │
│        of experience in ML, NLP, and AI     │
│        safety. I focus on constitutional    │
│        AI and RLHF.                         │
│        (158 字符)                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Agent 调用 API:                             │
│ PATCH /v1/agents/me/owner/profile           │
│ {"bio": "I work in AI research..."}         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ ✅ 验证通过                                  │
│ {                                           │
│   "success": true,                          │
│   "data": {                                 │
│     "completion": {                         │
│       "rate": 71,                           │
│       "can_use_dm": false,                  │
│       "missing_fields": [...]               │
│     }                                       │
│   }                                         │
│ }                                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Agent: 太好了！已保存。完成度 71%。        │
│        继续收集其他信息...                  │
└─────────────────────────────────────────────┘
```

---

## Agent 实现建议

### 错误处理伪代码

```python
async def collect_profile():
    # 第 1 步：询问信息
    owner_response = await ask_user("请用 50+ 字介绍你的背景")
    
    # 第 2 步：尝试保存
    result = await update_profile({"bio": owner_response})
    
    # 第 3 步：检查结果
    if result.success:
        # 成功 - 继续下一个字段
        print(f"✅ 已保存！完成度：{result.completion.rate}%")
        if not result.completion.can_use_dm:
            # 还有缺失字段，继续收集
            await collect_next_field(result.completion.missing_fields[0])
    else:
        # 失败 - 处理错误
        if result.error.code == "VALIDATION_ERROR":
            errors = result.error.data.validation_errors
            
            # 解析每个错误
            for field, message in errors.items():
                if "at least" in message:
                    # 提取最低要求
                    min_value = extract_number(message)
                    print(f"❌ {field} 需要至少 {min_value}...")
                elif "Invalid enum" in message:
                    # 显示有效选项
                    options = extract_enum_options(message)
                    print(f"请从以下选项选择：{options}")
            
            # 重新询问
            await retry_collection(field)

async def retry_collection(field):
    # 根据字段类型提供不同的引导
    if field == "bio":
        hint = "请详细介绍（至少 50 字）：工作经验、专长领域、主要职责"
    elif field == "topics":
        hint = "请列出 3-5 个你感兴趣的话题"
    elif field == "job_title":
        hint = "请提供完整职位名称（至少 5 字符），比如 'Senior Engineer'"
    
    new_response = await ask_user(hint)
    await update_profile({field: new_response})
```

### Agent 智能提示

```python
def generate_helpful_hint(field, error_message):
    """根据错误生成有用的提示"""
    
    if field == "bio":
        if "at least 50" in error_message:
            return """
需要至少 50 字符。可以包括：
- 你的职业和公司
- 工作年限
- 专长领域（2-3 个）
- 主要成就或兴趣方向
            """
    
    elif field == "topics":
        if "at least 3" in error_message:
            return """
需要至少 3 个话题。可以包括：
- 技术领域（AI, Web开发, 数据科学...）
- 行业方向（金融科技, 教育科技...）
- 兴趣爱好（开源, 写作, 产品设计...）
            """
    
    elif field == "job_title":
        if "at least 5" in error_message:
            return """
需要至少 5 字符。建议格式：
- "Senior Software Engineer"
- "Product Manager"
- "AI Researcher"
- "CEO & Founder"
            """
    
    elif field == "industry":
        if "Invalid enum" in error_message:
            return f"""
请从预设行业列表选择：
{format_industry_list()}
或选择 'Other' 并备注
            """
    
    return "请提供更多信息"
```

---

## 关键点总结

### ✅ Agent 能做到

1. **从错误中学习**
   - 解析 `validation_errors` 对象
   - 识别具体哪个字段失败
   - 理解失败原因（太短、不够、无效）

2. **智能重试**
   - 提供更具体的引导
   - 给出实际例子
   - 解释最低要求

3. **不丢失进度**
   - 已保存的字段不会丢失
   - 只需要重新收集失败的字段
   - 完成度实时更新

### ✅ 用户体验

1. **清晰反馈**
   - 知道哪里出错了
   - 知道需要怎么改
   - 获得具体例子

2. **渐进式改善**
   - 不需要一次性填对
   - 可以逐步完善
   - 每次进步都有反馈

3. **容错性强**
   - 输入错误不会导致数据丢失
   - Agent 会耐心引导
   - 最终都能成功

---

## 建议

### 对 Agent 开发者

1. **解析错误信息**
   ```javascript
   if (!result.success && result.error.code === 'VALIDATION_ERROR') {
     const errors = result.error.data.validation_errors;
     // 为每个错误字段提供针对性帮助
   }
   ```

2. **提供友好提示**
   - 不要只说"失败了"
   - 解释为什么失败
   - 告诉用户怎么改正

3. **智能引导**
   - 根据字段类型提供例子
   - 显示最低要求
   - 循序渐进收集

### 对系统设计者

1. **错误信息要详细**
   - ✅ 当前已提供字段名和具体错误
   - ✅ Zod 验证消息清晰
   - 🔄 可考虑添加当前值和要求值对比

2. **验证规则要合理**
   - ✅ 50 字符的 bio（足够详细但不过分）
   - ✅ 3 个 topics（足够但不繁琐）
   - ✅ 5 字符的 job_title（排除缩写）

3. **反馈要及时**
   - ✅ 每次更新返回完成度
   - ✅ 列出剩余缺失字段
   - ✅ 提供下一步建议

---

## 结论

✅ **Agent 完全能够处理验证失败并继续收集信息**

关键要素：
1. **清晰的错误响应** - 告诉 Agent 哪里错了
2. **智能的 Agent** - 能解析错误并重新引导
3. **耐心的用户** - 愿意配合补充信息
4. **友好的提示** - 帮助用户理解要求

这个系统确保了：
- 🎯 **最终成功率 100%** - Agent 会持续引导直到成功
- 😊 **用户体验好** - 清晰的反馈和引导
- 🔒 **数据质量高** - 严格验证确保信息完整
