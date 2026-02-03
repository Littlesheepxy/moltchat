# 🎉 启动脚本已更新

## 更新内容

### ✅ `start.sh` 现在会自动启动 Matrix

更新后的 `start.sh` 脚本现在会：

1. **检查 Matrix 配置**
   - 读取 `.env` 中的 `MATRIX_ENABLED` 设置
   - 如果为 `true`，自动启动 Matrix 服务

2. **启动 Matrix 服务**
   - 启动 Synapse (Matrix 服务器)
   - 启动 Element Web (Matrix 客户端)
   - 等待服务就绪

3. **显示正确的服务地址**
   - 当 Matrix 启用时，显示 Matrix 和 Element 的访问地址
   - 当 Matrix 未启用时，提示如何启用

### ✅ `stop.sh` 现在会停止 Matrix

更新后的 `stop.sh` 脚本现在会：
- 停止主服务（Gateway、Console、Database）
- 自动检测并停止 Matrix 服务（如果在运行）

---

## 📋 启动流程对比

### 之前（手动启动）

```bash
# 需要分别启动
./start.sh                                    # 启动 Gateway + Console + DB
docker-compose -f docker-compose.matrix.yml up -d  # 手动启动 Matrix
```

### 现在（一键启动）

```bash
# 一键启动所有服务
./start.sh
# 自动启动：Gateway + Console + DB + Matrix (如果已配置)
```

---

## 🎯 完整工作流

### 首次设置

```bash
# 1. 启动基础服务
./start.sh

# 2. 设置 Matrix（如果还没配置）
./setup-matrix.sh

# 3. 重启服务
# 按 Ctrl+C 停止
./start.sh
```

### 日常开发

```bash
# 启动（Matrix 会自动启动）
./start.sh

# 停止（Matrix 会自动停止）
./stop.sh
```

---

## 📊 启动输出示例

### Matrix 已启用时

```
[5/6] 检查 Matrix 配置...
启动 Matrix Synapse 和 Element Web...
等待 Matrix 启动...
✅ Matrix 已就绪

[6/6] 启动开发环境...
╔════════════════════════════════════════╗
║  ✅ MoltChat 已启动 (开发模式)        ║
╚════════════════════════════════════════╝

📱 Console:  http://localhost:3000
🔌 Gateway:  http://localhost:3001
🗄️  Database: localhost:5432
💬 Matrix:   http://localhost:8008
🌐 Element:  http://localhost:8080
```

### Matrix 未启用时

```
[5/6] 检查 Matrix 配置...
⚠️  Matrix 未启用 (MATRIX_ENABLED=false)
   如需启用，请运行: ./setup-matrix.sh

[6/6] 启动开发环境...
╔════════════════════════════════════════╗
║  ✅ MoltChat 已启动 (开发模式)        ║
╚════════════════════════════════════════╝

📱 Console:  http://localhost:3000
🔌 Gateway:  http://localhost:3001
🗄️  Database: localhost:5432
```

---

## ⚡ 优势

1. **更简单**：一个命令启动所有服务
2. **更智能**：自动检测 Matrix 配置
3. **更清晰**：明确显示哪些服务在运行
4. **更安全**：停止时不会遗漏 Matrix 服务

---

## 🔄 迁移指南

如果你之前手动启动过 Matrix：

```bash
# 1. 停止所有服务
docker-compose -f docker-compose.matrix.yml down
./stop.sh

# 2. 确认 .env 中 MATRIX_ENABLED=true
grep MATRIX_ENABLED .env

# 3. 重新启动（现在会自动包含 Matrix）
./start.sh
```

---

## 📚 相关文档

- **完整启动指南**: `STARTUP.md`
- **Matrix 设置指南**: `apps/console/MATRIX-SETUP.md`
- **Matrix 访问指南**: `apps/console/MATRIX-ACCESS.md`

---

现在你可以享受更流畅的开发体验了！🚀
