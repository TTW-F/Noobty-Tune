# deploy/frp — FRP 隧道(实际部署于 2026-09-10)

## 云机 106.14.175.93(frps)
- 单元:frps.service(系统级,已存在)
- 程序/配置:/opt/frp-noobty/frps + /opt/frp-noobty/frps.toml
- 端口:7000=隧道通道,8080=vhost(http 型代理),7500=管理面板(已用 iptables 禁止外网访问)

## 内网后端机 192.168.31.35(frpc)
- 单元:frpc.service(已存在,与其它服务共用)
- 程序/配置:/home/qwe/frp_0.52.3_linux_amd64/frpc -c frpc.ini
- 本项目新增段:[noobty-tune-backend] 3101 → 云机 3101

## 模板文件
- frps.toml / frpc.ini:与实机一致的参考模板(token 请自行更换)

## 红线
- 不要把 remote_port 3101 暴露公网(云机 iptables 已阻断 3101/7500 外网访问)
- frpc.ini 被多个服务共用,改动前先备份并确认不影响其他 [section]
