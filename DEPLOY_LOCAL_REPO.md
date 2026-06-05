# 本地仓库部署说明

如果你希望服务器始终部署“当前仓库分支 + 当前提交”的版本，而不是官方预构建镜像，请使用本方案。

## 为什么需要这套方案

默认的 `docker-compose.prod.yml` 和 `docker-compose.prod.cn.yml` 使用的是官方镜像：

- `ghcr.io/lintsinghua/deepaudit-frontend:latest`
- `ghcr.io/lintsinghua/deepaudit-backend:latest`

这意味着即使服务器已经切到你自己的分支，例如 `qianduanV1.0`，容器实际运行的也可能仍然是官方镜像内容。

## 推荐用法

在服务器仓库根目录执行：

```bash
cd /data/DeepAudit
chmod +x scripts/deploy-local-repo.sh
./scripts/deploy-local-repo.sh
```

脚本会自动：

- 读取当前 `git` 分支和提交号
- 生成本地镜像标签
- 使用 `docker-compose.localrepo.yml` 基于当前仓库代码重建前端和后端镜像
- 输出当前运行容器对应的镜像版本

默认不会构建 `sandbox`，因为沙箱镜像依赖额外安全工具下载，部分服务器会因为访问 GitHub 失败而中断整个部署。

## 适用场景

- 服务器长期部署你自己的分支
- 前端、后端有持续自定义改动
- 不希望因为 `latest` 镜像覆盖而丢失本地仓库版本

## 手动执行方式

如果不使用脚本，也可以手动执行：

```bash
cd /data/DeepAudit
export DEPLOY_TAG="$(git branch --show-current | tr '/:@ ' '-')-$(git rev-parse --short HEAD)"
export SANDBOX_ENABLED=false
docker compose -f docker-compose.localrepo.yml up -d --build --remove-orphans
```

## 如需构建本地 sandbox

仅当你的服务器 Docker 构建环境可以稳定访问外网时，再启用：

```bash
cd /data/DeepAudit
./scripts/deploy-local-repo.sh --with-sandbox
```

等价手动命令：

```bash
cd /data/DeepAudit
export DEPLOY_TAG="$(git branch --show-current | tr '/:@ ' '-')-$(git rev-parse --short HEAD)"
export SANDBOX_ENABLED=true
docker compose -f docker-compose.localrepo.yml --profile sandbox up -d --build --remove-orphans
```

## 验证是否生效

```bash
docker ps --format "table {{.Names}}\t{{.Image}}"
```

你应该看到类似：

```text
deepaudit-frontend-1   deepaudit-frontend:qianduanV1.0-b0cf14f
deepaudit-backend-1    deepaudit-backend:qianduanV1.0-b0cf14f
```

如果仍然看到 `ghcr.io/lintsinghua/deepaudit-frontend:latest`，说明你还在使用官方镜像部署链路，而不是本地仓库部署链路。

## V6.0 部署差异

V6.0 仍然沿用 `docker-compose.localrepo.yml` 和 `scripts/deploy-local-repo.sh` 的部署方式，不新增外部端口。`docker-compose.localrepo.yml` 已包含 `db-migrate` 服务，执行部署脚本时会自动运行最新数据库迁移，用于添加定时扫描窗口字段和扫描模式字段。

如需在非 Docker 环境或故障恢复场景手动执行迁移，可运行：

```bash
cd /data/DeepAudit/backend
alembic upgrade head
```

V6.0 镜像内容和运行行为有以下变化：

- 快速扫描默认改为纯规则引擎：
  - 默认不再隐式调用 LLM 精查，适合批量快速检测
  - 后端会提前剪枝排除目录，并行执行本地规则扫描
- 创建扫描任务时，高级选项新增定时计划：
  - 支持扫描周期
  - 支持允许扫描时间段
  - 支持选择后续计划任务使用快速扫描或 Agent 审计模式
  - 本次扫描立即启动，后续扫描由计划任务按所选模式自动生成
- 系统管理：
  - 创建用户时“姓名”可留空
  - 知识库启动时会幂等补种内置通用漏洞知识
- Agent 审计启动页品牌显示为 `TopSec Audit`
- 前端文件选择弹窗修复居中定位，不再在右下角抖动

升级完成后，建议额外验证：

- 创建快速扫描和 Agent 审计任务时是否能保存定时扫描计划
- 时间窗口外的定时扫描是否会顺延到下一个允许时间
- 系统管理中的定时扫描列表是否正确显示“快速审计 / Agent 审计”
- 系统管理创建用户时是否允许姓名为空
- 系统管理知识库是否已有内置漏洞知识条目
- Agent 审计入口是否显示 `TopSec Audit`
- 高级选项中的“选择文件”弹窗是否居中

## V5.0 部署差异

V5.0 仍然沿用 `docker-compose.localrepo.yml` 和 `scripts/deploy-local-repo.sh` 的部署方式，不新增常驻服务、不改变外部端口 `3000`，但镜像内容有几处变化：

- `backend` 镜像新增 `subversion`、`p7zip-full`、`unrar-free` 和 `semgrep`
  - 用于支持 `svn export`
  - 用于支持 `.rar/.7z/.tar/.gz/.tgz/.tar.gz` 归档解压
  - 用于快速扫描的本地规则引擎
- `frontend/nginx.conf` 的 `client_max_body_size` 已提升到 `2g`
  - 支持大体积源码归档上传
- `frontend` 容器启动时会自动生成局域网自签 HTTPS 证书
  - 无需手动准备证书或修改部署脚本
  - 访问地址改为 `https://<服务器局域网IP>:3000`
  - 浏览器提示证书不受信任是预期现象，选择继续访问即可
- 默认管理员账号固定为：
  - 用户名：`admin`
  - 密码：`Admin@123456`
  - 首次启动后会自动初始化；公开注册已关闭，其他用户需在系统管理页面创建

如果你从旧版本升级，请特别注意：

- 先执行数据库迁移：

```bash
cd /data/DeepAudit/backend
alembic upgrade head
```

- 再执行本地仓库部署脚本或 `docker compose ... up -d --build`

升级完成后，建议额外验证以下内容：

- 能否使用 `admin / Admin@123456` 登录
- 前端是否允许上传大于 `500MB` 的归档
- 后端容器内是否可执行 `semgrep --version`
- SVN、RAR、7Z 等新增能力是否在目标环境可用
