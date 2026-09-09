# GitHub 安全部署手册

本手册用于将项目部署到新的生产拓扑:云服务器作为入口,后端运行在内网机并通过 FRP 隧道接入,同时确保不影响服务器上其他项目。

> 交接与线上现状先读:`docs/operations/handover-deployment-status.md`
>
> 变更记录:2026-09-10 起原主机 `47.100.17.7` 已弃用,生产入口迁移至 `106.14.175.93`。

## 0. 生产拓扑

```
                    GitHub Actions (main push)
                            │ npm ci && npm run build
                            │ scp dist 产物
                            ▼
        ┌─────────────────────────────────────────────┐
        │  云服务器 106.14.175.93 (入口, Ubuntu)        │
        │  ├─ nginx :80/:443                          │
        │  │   ├─ tune.noobty.top      → 静态前端      │
        │  │   │    /srv/noobty-tune/current           │
        │  │   └─ backend.tune.noobty.top → 127.0.0.1:3101
        │  └─ frps :7500 (隧道服务端)                  │
        │         ▲ 127.0.0.1:3101 ← frp 隧道          │
        └─────────┼───────────────────────────────────┘
                  │ (公网加密隧道)
        ┌─────────┴───────────────────────────────────┐
        │  内网后端机 192.168.31.35                     │
        │  ├─ noobty-tune-backend.service :3101        │
        │  │   (仅监听 127.0.0.1)                      │
        │  └─ frpc → 注册到云机 frps                    │
        └─────────────────────────────────────────────┘
```

要点:

- 后端真实进程只存在于内网机 `192.168.31.35`,不监听公网。
- 云机 nginx 的 `proxy_pass http://127.0.0.1:3101` 目标是 **frps 打开的隧道端口**,内网机掉线时该端口无监听,nginx 返回 502——这是预期表现,恢复隧道即自愈。
- 证书、HTTPS、域名全部只在云机上维护;内网机零公网暴露。

## 1. 安全隔离原则

- 云机仅使用独立目录:`/srv/noobty-tune`
- 仅使用独立子域名:`tune.noobty.top`(前端)与 `backend.tune.noobty.top`(后端)
- 仅新增独立 Nginx 配置,不修改已有站点配置
- 云机部署用户独立:`deploy_noobty`;内网机服务用户:`noobty`
- 发布采用 `releases + current`,失败不切换线上版本
- 后端端口只监听 `127.0.0.1`,公网零暴露

## 2. 部署前参数清单

上线前先确认下列参数,再配置到 GitHub Secrets:

| Secret 名称 | 值 | 说明 |
| --- | --- | --- |
| `DEPLOY_HOST` | `106.14.175.93` | 云服务器公网 IP(已随新拓扑更新) |
| `DEPLOY_PORT` | `22` | SSH 端口 |
| `DEPLOY_USER` | `deploy_noobty` | 云机独立部署用户 |
| `DEPLOY_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----...` | 对应部署用户私钥 |
| `DEPLOY_PATH` | `/srv/noobty-tune` | 项目独立发布根目录 |

## 3. 云服务器一次性初始化(106.14.175.93)

以下命令不改动其他项目目录:

```bash
sudo adduser --disabled-password --gecos "" deploy_noobty
sudo mkdir -p /srv/noobty-tune/releases /srv/noobty-tune/shared
sudo chown -R deploy_noobty:deploy_noobty /srv/noobty-tune
sudo chmod -R 750 /srv/noobty-tune
```

安装 frp 服务端(参考 `deploy/frp/frps.toml`):

```bash
# 下载对应架构的 frp 发布包后:
sudo install -m 755 frps /usr/local/bin/frps
sudo mkdir -p /etc/noobty-tune
sudo install -m 600 deploy/frp/frps.toml /etc/noobty-tune/frps.toml   # 先改 auth.token!
sudo cp deploy/systemd/noobty-tune-frps.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now noobty-tune-frps
```

防火墙/安全组放行:`22/tcp`、`80/tcp`、`443/tcp`、`7500/tcp`(frp 隧道)。

## 4. 内网后端机初始化(192.168.31.35)

```bash
sudo useradd --system --disabled-password --gecos "" noobty
sudo mkdir -p /srv/noobty-tune-backend /etc/noobty-tune
sudo chown -R noobty:noobty /srv/noobty-tune-backend

# 占位后端(真实后端就绪前保证 /health 可用)
sudo -u noobty cp deploy/scripts/backend_placeholder.py /srv/noobty-tune-backend/

# 后端服务(只监听 127.0.0.1:3101)
sudo cp deploy/systemd/noobty-tune-backend.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now noobty-tune-backend

# frp 客户端
sudo install -m 755 frpc /usr/local/bin/frpc
sudo install -m 600 deploy/frp/frpc.toml /etc/noobty-tune/frpc.toml   # 先改 auth.token!
sudo cp deploy/systemd/noobty-tune-frpc.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now noobty-tune-frpc
```

验证隧道:`ss -lnt | grep 3101`(内网机)与 `curl http://127.0.0.1:3101/health`(云机上执行,通则隧道 OK)。

## 5. Nginx 站点与串站防护

仓库内模板(`deploy/nginx/`):

| 文件 | 作用 |
| --- | --- |
| `00-default-catchall.conf` | **串站防护兜底**:以 `default_server` 接管所有未知 Host,`return 444` 直接断开 |
| `noobty-tune.conf` | 前端:80 跳 443,443 静态服务 + SPA 回退 + assets 长缓存 |
| `backend.tune.noobty.top.conf` | 后端:80 跳 443,443 反代 `127.0.0.1:3101`(frp 隧道上游) |

**为什么必须装兜底站点**:nginx 对每个端口都有一个"隐式默认站点"——Host 匹配不到任何 `server_name` 的请求(用 IP 访问、别的域名解析到本机但本机无对应 server 块)会被交给 `sites-enabled` 里加载顺序最前的 conf。这就是此前"其他项目域名被导到本项目"的根因。`00-` 前缀保证兜底站点第一个加载,从机制上杜绝串站。

安装(首次签发证书前,先注释掉模板中的 443 段,签发后恢复):

```bash
sudo cp deploy/nginx/00-default-catchall.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/00-default-catchall.conf /etc/nginx/sites-enabled/
sudo cp deploy/nginx/noobty-tune.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/noobty-tune.conf /etc/nginx/sites-enabled/
sudo cp deploy/nginx/backend.tune.noobty.top.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/backend.tune.noobty.top.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

签发证书(域名 A 记录必须已指向 `106.14.175.93`):

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/www/html \
  -d tune.noobty.top -d backend.tune.noobty.top
# 签发完成后恢复 443 段 → sudo nginx -t && sudo systemctl reload nginx
```

注意:`default_server` 每端口只能有一个。若云机上已有其他项目声明了 `default_server`,不要再启用本项目的兜底文件,改为把 `return 444` 的兜底逻辑并入已有默认站点。

## 6. GitHub Actions 工作流说明

工作流文件:`.github/workflows/deploy.yml`

流程:

1. 拉取代码并执行构建(`npm ci && npm run build`)
2. 打包 `dist` 目录到发布包
3. 通过 SSH 上传到云机 `/tmp/<release>.tgz`
4. 调用 `deploy/deploy.sh` 完成解包、检查、原子切换与 Nginx reload

后端不在该工作流部署范围内(后端在内网机,由 systemd 守护,代码更新需登录内网机或在后续为内网机单独加发布通道)。

## 7. 回滚操作

查看历史版本(云机):

```bash
ls -1dt /srv/noobty-tune/releases/*
```

回滚到指定版本:

```bash
ln -sfn <old_release> /srv/noobty-tune/current
sudo nginx -t && sudo systemctl reload nginx
```

## 8. 上线验收清单

- `https://tune.noobty.top` 与 `https://backend.tune.noobty.top` 访问正常,证书有效
- 麦克风权限可正常弹出并授权(HTTPS 是前提)
- **串站验收**:用服务器 IP 直接访问、以及用一个未配置的域名访问,均应"连接被重置"(444),绝不出现本项目页面
- 云机 `curl http://127.0.0.1:3101/health` 返回 ok(隧道通)
- 断开内网机 frpc 后,后端域名返回 502 而非串到其他站点;重启后自愈
- 服务器上其他项目域名访问、端口监听、日志均无异常
- 回滚命令已实测可用

## 9. 一键巡检(推荐)

脚本路径:`deploy/scripts/server_healthcheck.sh`(支持两种角色)

```bash
# 云服务器 106.14.175.93:nginx / frps / 域名 / 证书 / 串站检测
sudo ROLE=cloud /srv/noobty-tune/shared/server_healthcheck.sh

# 内网后端机 192.168.31.35:后端服务 / frpc / 隧道日志
sudo ROLE=lan /srv/noobty-tune/shared/server_healthcheck.sh
```
