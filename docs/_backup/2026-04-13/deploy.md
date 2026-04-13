# GitHub 安全部署手册

本手册用于将项目部署到 Ubuntu 云服务器，并确保不影响服务器上其他项目。

## 0. 交接入口（先读）

在进行任何线上变更前，先阅读：

- `docs/handover-deployment-status.md`

该文档记录当前线上真实状态、变更红线、端口约束与回滚入口，用于避免误操作。

## 1. 安全隔离原则

- 仅使用独立目录：`/srv/noobty-tune`
- 仅使用独立子域名：`tune.noobty.top`（前端）与 `backend.tune.noobty.top`（后端）
- 仅新增独立 Nginx 配置，不修改已有站点配置
- 仅使用独立部署用户，不复用其他项目账号
- 发布采用 `releases + current`，失败不切换线上版本

## 2. 部署前参数清单

上线前先确认下列参数，再配置到 GitHub Secrets：

| Secret 名称 | 示例 | 说明 |
| --- | --- | --- |
| `DEPLOY_HOST` | `203.0.113.10` | 云服务器公网 IP 或域名 |
| `DEPLOY_PORT` | `22` | SSH 端口 |
| `DEPLOY_USER` | `deploy_noobty` | 独立部署用户 |
| `DEPLOY_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | 对应部署用户私钥 |
| `DEPLOY_PATH` | `/srv/noobty-tune` | 项目独立发布根目录 |

## 3. 服务器一次性初始化（仅执行一次）

以下命令不会改动其他项目目录：

```bash
sudo adduser --disabled-password --gecos "" deploy_noobty
sudo mkdir -p /srv/noobty-tune/releases /srv/noobty-tune/shared
sudo chown -R deploy_noobty:deploy_noobty /srv/noobty-tune
sudo chmod -R 750 /srv/noobty-tune
```

将仓库中的 Nginx 模板复制为新站点配置（不覆盖任何已有配置）：

```bash
sudo cp deploy/nginx/noobty-tune.conf /etc/nginx/sites-available/noobty-tune.conf
sudo ln -s /etc/nginx/sites-available/noobty-tune.conf /etc/nginx/sites-enabled/noobty-tune.conf
sudo cp deploy/nginx/backend.tune.noobty.top.conf /etc/nginx/sites-available/backend.tune.noobty.top.conf
sudo ln -s /etc/nginx/sites-available/backend.tune.noobty.top.conf /etc/nginx/sites-enabled/backend.tune.noobty.top.conf
sudo nginx -t
sudo systemctl reload nginx
```

说明：
- 当前服务器上 `3000`、`8080`、`8082`、`1935`、`1986` 已被其他项目占用。
- 后端反向代理建议先使用 `127.0.0.1:3101`（已在模板中设置），避免与已有业务冲突。
- 已确认 `3101` 当前空闲，可作为本项目保留端口。若未来冲突，改为 `3102/3110` 并同步更新 Nginx 与后端服务。

## 3.1 后端服务模板（避免端口冲突）

- 模板文件：`deploy/systemd/noobty-tune-backend.service`
- 默认端口：`3101`
- 启动前会执行端口占用检查，若端口被占用则服务启动失败（不影响其他项目）
- 占位后端脚本：`deploy/scripts/backend_placeholder.py`

## 4. GitHub Actions 工作流说明

工作流文件：`.github/workflows/deploy.yml`

流程如下：

1. 拉取代码并执行构建（默认 `npm ci && npm run build`）
2. 打包 `dist` 目录到发布包
3. 通过 SSH 上传到服务器 `/tmp/<release>.tgz`
4. 调用 `deploy/deploy.sh` 完成解包、检查、原子切换与 Nginx reload

如果你的构建命令或产物目录不同，请修改工作流里的：

- `BUILD_COMMAND`
- `BUILD_OUTPUT`

## 5. 回滚操作

查看历史版本：

```bash
ls -1dt /srv/noobty-tune/releases/*
```

回滚到上一版本（把 `<old_release>` 替换成真实路径）：

```bash
ln -sfn <old_release> /srv/noobty-tune/current
sudo nginx -t && sudo systemctl reload nginx
```

## 6. 上线验收清单（防止影响其他项目）

- 新子域名访问正常：`https://tune.noobty.top` 与 `https://backend.tune.noobty.top`
- HTTPS 证书有效，浏览器无证书告警
- 麦克风权限可正常弹出并授权（HTTPS 是前提）
- `nginx -t` 通过，reload 后无报错
- 其他项目域名访问、端口监听、日志均无异常
- 回滚命令已实测可用

## 7. 一键巡检（推荐）

脚本路径：`deploy/scripts/server_healthcheck.sh`

用途：
- 检查 Nginx 配置语法
- 检查 `nginx` 和 `noobty-tune-backend.service` 状态
- 检查关键端口（`80`、`443`、`3101`）
- 检查前后端域名 HTTP/HTTPS 可用性
- 输出证书状态并执行续期模拟

在服务器执行：

```bash
chmod +x /srv/noobty-tune/shared/server_healthcheck.sh
/srv/noobty-tune/shared/server_healthcheck.sh
```
