# 🐛 开发模式创建房间问题修复

## 问题：UUID 类型错误

### 错误信息
```
invalid input syntax for type uuid: "dev_1770108663392"
```

### 根本原因

1. **数据库 Schema 约束**：
   - `agents.id` 是 UUID 类型
   - `rooms.owner_id` 引用 `agents.id`（外键约束）
   - `room_members.agent_id` 也引用 `agents.id`

2. **开发模式冲突**：
   - dev-login 使用 `dev_<timestamp>` 作为 agent_id
   - 不是有效的 UUID 格式
   - 数据库中也没有对应的 agent 记录

### 解决方案

为开发模式的用户**自动创建数据库记录**：

1. **将 dev agent_id 转换为确定性的 UUID**
   - 使用 MD5 hash `dev_1770108663392` 
   - 格式化为标准 UUID：`a1b2c3d4-e5f6-7890-abcd-ef1234567890`

2. **自动创建 agent 记录**
   - 如果 UUID 不存在，插入新记录
   - 状态设为 `claimed`
   - 名称：`Dev Agent dev_xxx`

3. **更新 authResult**
   - 将 `agentId` 替换为 UUID
   - 后续所有数据库操作使用 UUID

---

## 代码修改

### `apps/gateway/src/routes/rooms.ts`

```typescript
// Check if this is a dev mode agent
const isDevAgent = authResult.agentId.startsWith('dev_');
let agent: AgentRow | null = null;

if (isDevAgent) {
  // 1. 生成确定性 UUID
  const devAgentUuid = crypto.createHash('md5')
    .update(authResult.agentId)
    .digest('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  
  // 2. 创建或获取 agent 记录
  agent = await queryOne<AgentRow>(
    `INSERT INTO agents (id, name, twitter_handle, status, claimed_at)
     VALUES ($1, $2, $3, 'claimed', NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, status, matrix_user_id, matrix_access_token`,
    [devAgentUuid, `Dev Agent ${authResult.agentId}`, `dev_${authResult.agentId}`]
  );
  
  // 3. 替换为 UUID
  authResult.agentId = devAgentUuid;
} else {
  // 正常流程...
}
```

### `apps/gateway/src/lib/auth.ts`

```typescript
// 开发模式下，允许 dev_ 开头的 agent_id
if (agentId.startsWith('dev_')) {
  return {
    agentId: agentId,  // 保留原始 dev_ ID
    tokenId: 'mvp-bypass-dev',
    tokenType: 'agent',
  };
}
```

### `apps/console/lib/api.ts`

```typescript
// 检测 dev token，使用 agent_id 参数
const isDevToken = token?.startsWith('dev_token_');
if (agentData && (!token || isDevToken)) {
  finalUrl = `${url}?agent_id=${agent.id}`;
}
```

---

## ✅ 测试流程

### 1. 重新开发登录

```bash
# 访问开发登录页
open http://localhost:3000/dev-login

# 点击 "Alice AI" 快速登录
# 跳转到：http://localhost:3000/console?user_id=dev_xxx
```

### 2. 创建房间

```bash
# 点击 "Create Room"
# 填写房间名称：test

# 点击 "Create Room" 按钮
# ✅ 不再报 UUID 错误
# ✅ 自动跳转到房间详情页
# ✅ URL 保留 user_id 参数
```

### 3. 检查数据库

```sql
-- 查看自动创建的 dev agent
SELECT id, name, twitter_handle, status 
FROM agents 
WHERE twitter_handle LIKE 'dev_%';

-- 应该看到类似：
-- id                                   | name                      | twitter_handle      | status
-- a1b2c3d4-e5f6-7890-abcd-ef1234567890 | Dev Agent dev_1770108663 | dev_dev_1770108663 | claimed
```

---

## 🎯 优势

1. **无缝开发体验**
   - 不需要手动创建 agent
   - 不需要真实的 Twitter 认证
   - 快速测试房间功能

2. **数据一致性**
   - 所有外键约束正常工作
   - 数据库完整性保持

3. **确定性 UUID**
   - 相同的 dev_id 总是生成相同的 UUID
   - 可以重复登录同一个开发账号

---

刷新页面，现在应该可以成功创建房间了！🎉
