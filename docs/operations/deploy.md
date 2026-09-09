# GitHub 安全部署手册

本手册用于将项目部署到当前生产拓扑:云服务器作为入口,后端运行在内网机并通过 FRP 隧道接入,同时确保不影响同一台云机上的其他项目。

> 交接与线上现状先读:`docs/operations/handover-deployment-status.md`(与本文档同步更新于 2026-09-10)
>
> 历史变更:2026-09-10 起原主机 `47.100.17.7` 弃用,生产入口迁移至 `106.14.175.93`。

## 0. 生产拓扑(已上线并实测)

```
                    GitHub Actions (main push, node 24)
                            │ npm ci && npm run build
                            │ scp dist 产物
                            ▼
        ┌──────────────────────────────────────────────────┐
        │  云服务器 106.14.175.93(多项目共用,克制改动)        │
        │  ├─ 自编译 nginx(/usr/local/nginx):80/:443        │
        │  │   ├─ tune.noobty.top       → 静态前端           │
        │  │   │    /srv/noobty-tune/current(原子切换)       │
        │  │   ├─ backend.tune.noobty.top → 127.0.0.1:3101  │
        │  │   └─ 00-default-catchall.conf → 未知域名 444     │
        │  └─ frps.service:7000(隧道)  面板:7500(已封外网)   │
        │              ▲ 127.0.0.1:3101 ← frp 隧道           │
        └──────────────┼───────────────────────────────────┘
                       │ (公网加密隧道)
        ┌──────────────┴───────────────────────────────────┐
        │  内网后端机 192.168.31.35(qwe-A7S)                 │
        │  ├─ noobty-tune-backend.service :3101(仅 127.0.0.1)│
        │  └─ frpc.service → [noobty-tune-backend] 段        │
        └──────────────────────────────────────────────────┘
```

要点:

- 后端真实进程只存在于内网机,不监听公网;云机 `127.0.0.1:3101` 的上游是 **frp 隧道**(frps 代持监听)。
- 内网机掉线时隧道断开,后端域名返回 502——预期表现,恢复 frpc 即自愈。
- 云机的 nginx 是**自编译版**(`/usr/local/nginx`),配置树在 `/usr/local/nginx/conf/conf.d/`;发行版 `/etc/nginx` 与 `/usr/sbin/nginx` 在该机是死路径,不要使用。

## 1. 安全隔离原则

- 云机仅使用独立目录 `/srv/noobty-tune`;独立域名 `tune.noobty.top` / `backend.tune.noobty.top`;独立部署用户 `deploy_noobty`
- 发布采用 `releases + current` 原子切换,`nginx -t` 失败不切换
- 后端仅监听内网机 `127.0.0.1`,公网零暴露(云机 iptables 已阻断 3101/7500 外网访问,规则已持久化)
- 云机为多项目共用机:禁止全局防火墙开关(会误伤其他服务),只允许定点规则;禁止改动其他项目的 conf

## 2. 部署前参数清单(GitHub Secrets)

| Secret 名称 | 值 | 说明 |
| --- | --- | --- |
| `DEPLOY_HOST` | `106.14.175.93` | 云服务器公网 IP |
| `DEPLOY_PORT` | `22` | SSH 端口 |
| `DEPLOY_USER` | `deploy_noobty` | 云机独立部署用户 |
| `DEPLOY_SSH_KEY` | ed25519 私钥(2026-09-10 轮换) | 公钥已装入云机 `deploy_noobty` |
| `DEPLOY_PATH` | `/srv/noobty-tune` | 项目独立发布根目录 |

## 3. 云服务器(106.14.175.93)关键配置

以下均已就位,列出处仅为变更时核对:

- 部署用户:`deploy_noobty`(sudoers 白名单:`/usr/local/nginx/sbin/nginx -t` 与 `-s reload`,见 `/etc/sudoers.d/deploy_noobty_nginx`)
- 发布目录:`/srv/noobty-tune/{releases,current,shared}`
- nginx 站点(**生效配置树是 `/usr/local/nginx/conf/conf.d/`**):
  - `tune.conf` — 前端 + 后端反代(certbot 托管)
  - `00-default-catchall.conf` — 串站防护兜底(`default_server → 444`)
- frps:`frps.service`(`/opt/frp-noobty/frps -c /opt/frp-noobty/frps.toml`;隧道 7000,vhost 8080,面板 7500)
- 防火墙:iptables 对外封禁 `3101`、`7500`,已通过 netfilter-persistent 持久化
- ⚠️ 云机遗留的旧占位后端单元 `noobty-tune-backend.service` 已 stop + disable,不要在云机重新启用

## 4. 内网后端机(192.168.31.35)关键配置

- 服务用户 `noobty`;工作目录 `/srv/noobty-tune-backend/`(当前为 `backend_placeholder.py`)
- 单元:`noobty-tune-backend.service`(127.0.0.1:3101,启动前做端口占用预检;模板见 `deploy/systemd/noobty-tune-backend.service`)
- 隧道:`frpc.service` 配置文件 `/home/qwe/frp_0.52.3_linux_amd64/frpc.ini` 中的 `[noobty-tune-backend]` 段(3101 → 云机 3101)
- 该 frpc.ini 被内网机多个服务共用:追加 section 前先备份,restart frpc 会瞬断全部隧道

## 5. CI/CD 工作流

工作流:`.github/workflows/deploy.yml`(仅覆盖前端静态产物)

1. node 24 环境,`npm ci && npm run build`
2. 打包 `dist` → SSH 上传 `/tmp/<release>.tgz`
3. `deploy/deploy.sh`:解包 → `index.html` 健康检查 → `/usr/local/nginx/sbin/nginx -t` → 原子切换 `current` → reload → 清理旧版本(保留 5 份)

后端不在该工作流范围内;后端代码更新需登录内网机操作(后续可为内网机单独加发布通道)。

## 6. 回滚操作

```bash
ls -1dt /srv/noobty-tune/releases/*
ln -sfn <old_release> /srv/noobty-tune/current
/usr/local/nginx/sbin/nginx -s reload
```

## 7. 上线验收清单

- `https://tune.noobty.top` 正常、证书有效;`https://backend.tune.noobty.top/health` 返回 ok
- 麦克风权限可正常弹出(HTTPS 是前提)
- **串站验收**:未知域名 / 直接 IP 访问均为连接被拒(444);同机其他项目域名(blog/tts/video 等)全部正常
- 云机 `curl http://127.0.0.1:3101/health` 走隧道返回 ok
- 断开内网机 frpc → 后端域名 502(而非串站);恢复后自愈
- 外网探测 `106.14.175.93:3101` 与 `:7500` 均不可达
- 回滚命令实测可用

## 8. 一键巡检

```bash
# 云机(nginx/frps/域名/证书/串站)
sudo ROLE=cloud bash /srv/noobty-tune/shared/server_healthcheck.sh

# 内网机(后端/frpc/隧道日志)
sudo ROLE=lan bash deploy/scripts/server_healthcheck.sh
```
