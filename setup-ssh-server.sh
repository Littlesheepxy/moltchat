#!/bin/bash

# MoltChat SSH 服务器配置脚本
# 用于快速配置 SSH 免密登录

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   MoltChat SSH 服务器配置向导        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""

# 检查是否存在公钥
if [ ! -f ~/.ssh/id_ed25519.pub ]; then
    echo -e "${RED}❌ 未找到 SSH 公钥 (~/.ssh/id_ed25519.pub)${NC}"
    echo -e "${YELLOW}请先运行: ssh-keygen -t ed25519${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 找到 SSH 公钥${NC}"
echo ""

# 提示输入服务器信息
read -p "输入服务器 IP 地址: " SERVER_IP
read -p "输入用户名 (默认 root): " SERVER_USER
SERVER_USER=${SERVER_USER:-root}
read -p "输入 SSH 端口 (默认 22): " SERVER_PORT
SERVER_PORT=${SERVER_PORT:-22}

echo ""
echo -e "${YELLOW}开始配置...${NC}"
echo ""

# 1. 复制公钥到服务器
echo -e "${YELLOW}[1/3] 复制公钥到服务器...${NC}"
if ssh-copy-id -i ~/.ssh/id_ed25519.pub -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP}; then
    echo -e "${GREEN}✓ 公钥已复制${NC}"
else
    echo -e "${RED}❌ 公钥复制失败${NC}"
    echo -e "${YELLOW}请手动执行以下命令：${NC}"
    echo "ssh-copy-id -i ~/.ssh/id_ed25519.pub -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP}"
    exit 1
fi

# 2. 创建/更新 SSH config
echo -e "${YELLOW}[2/3] 配置 SSH config...${NC}"

# 检查是否已存在 moltchat 配置
if grep -q "Host moltchat" ~/.ssh/config 2>/dev/null; then
    echo -e "${YELLOW}⚠️  SSH config 中已存在 moltchat 配置${NC}"
    read -p "是否覆盖? (y/N): " OVERWRITE
    if [[ ! $OVERWRITE =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}跳过 SSH config 配置${NC}"
    else
        # 删除旧配置
        sed -i.bak '/^# MoltChat 生产服务器$/,/^$/d' ~/.ssh/config
    fi
fi

# 添加新配置
cat >> ~/.ssh/config << EOF

# MoltChat 生产服务器
Host moltchat
    HostName ${SERVER_IP}
    User ${SERVER_USER}
    Port ${SERVER_PORT}
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
    ServerAliveCountMax 3
EOF

chmod 600 ~/.ssh/config
echo -e "${GREEN}✓ SSH config 已配置${NC}"

# 3. 测试连接
echo -e "${YELLOW}[3/3] 测试连接...${NC}"
if ssh -o ConnectTimeout=5 -o BatchMode=yes moltchat "echo '连接成功'" 2>/dev/null; then
    echo -e "${GREEN}✓ 连接测试成功！${NC}"
else
    echo -e "${YELLOW}⚠️  自动测试失败，请手动测试: ssh moltchat${NC}"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          🎉 配置完成！               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}现在可以使用以下命令连接服务器：${NC}"
echo -e "  ${GREEN}ssh moltchat${NC}"
echo ""
echo -e "${YELLOW}其他有用的命令：${NC}"
echo -e "  上传文件: ${GREEN}scp file.txt moltchat:/root/${NC}"
echo -e "  下载文件: ${GREEN}scp moltchat:/root/file.txt ./${NC}"
echo -e "  同步目录: ${GREEN}rsync -avz folder/ moltchat:/root/folder/${NC}"
echo ""
