# Infra Report — 2026-05-07T23:40

## VM Specs
- OS: Ubuntu 22.04.5 LTS (kernel 6.8.0-1053-gcp)
- vCPU: 2 (Intel Xeon @ 2.20GHz, KVM hypervisor)
- RAM: 3.8 GiB total, **2.6 GiB disponibles**, 4 GiB swap (776 MiB usado)
- Disco: 29 GB total, **14 GB libres** (52% usado)
- Hostname: omada-controller
- FQDN: soporte.lamarque.mx

## Stack actual confirmado

| Servicio | Versión | Estado | Puerto(s) |
|---|---|---|---|
| Apache 2 | 2.4.52 | active/running | :80, :443 |
| MariaDB | 10.6.23 | active/running | 127.0.0.1:3306 |
| Omada Controller (tpeap/jsvc) | desconocida | active/running | :8043, :8088, :8843, :29811-29816 |
| MongoDB (Omada) | desconocida | active/running | 127.0.0.1:27217 |
| fluent-bit (GCP Ops) | desconocida | active/running | :20202 |
| otelopscol (GCP Ops) | desconocida | active/running | :20201 |
| sshd | OpenSSH | active/running | :22 |
| Docker | — | **NO instalado** | — |

**Nota adicional:** Existe un cron diario de root que hace backup de DB `glpidb` (aplicación GLPI en el LAMP). No estaba documentada en el brief inicial — forma parte del stack LAMP existente. No se toca.

**VirtualHost Apache:** soporte.lamarque.mx (SSL via Let's Encrypt) en :80 y :443.

## Puertos en uso (lista exacta)

```
tcp  :22       sshd
tcp  :80       apache2
tcp  :443      apache2
tcp  :3306     mariadbd (127.0.0.1)
tcp  :8043     jsvc (Omada)
tcp  :8088     jsvc (Omada)
tcp  :8843     jsvc (Omada)
tcp  :20201    otelopscol
tcp  :20202    fluent-bit
tcp  :27217    mongod (127.0.0.1)
tcp  :29811-29816  jsvc (Omada)
udp  :29810    jsvc (Omada)
udp  :27001    jsvc (Omada)
udp  :53       systemd-resolved (127.0.0.53)
```

## Puertos asignados al stack Lighthouse (verificados libres)

| Puerto | Servicio | Bind |
|---|---|---|
| 9080 | Caddy HTTP | 0.0.0.0 |
| 9443 | Caddy HTTPS | 0.0.0.0 |
| 5433 | Postgres | 127.0.0.1 |
| 6380 | Redis | 127.0.0.1 |
| 5678 | n8n | 127.0.0.1 |
| 8001 | Evolution API | 127.0.0.1 |
| 3001 | Chatwoot | 127.0.0.1 |
| 8002 | booksy-executor | 127.0.0.1 |

**Todos verificados libres al 2026-05-07T23:40** ✅

## Estado del usuario lighthouse

- Existe: **SÍ** (UID 1002, GID 1003)
- Sudoers: **validado** (`/etc/sudoers.d/lighthouse`)
- .ssh/authorized_keys: **presente, vacío** (modo 600, dueño lighthouse:lighthouse)
- .ssh/ directorio: modo 700, dueño lighthouse:lighthouse ✅
- En grupo docker: **NO** (se agrega al instalar Docker)

## Recursos vs demanda esperada

| Servicio | RAM proyectada |
|---|---|
| Postgres 16 | 256 MiB |
| Redis 7 | 128 MiB |
| n8n | 512 MiB |
| Evolution API | 512 MiB |
| Chatwoot | 768 MiB |
| Caddy 2 | 64 MiB |
| booksy-executor | 768 MiB |
| **Total stack** | **~3,008 MiB** |

- Stack mínimo proyectado en pico: ~3 GiB RAM
- RAM disponible actual: 2.6 GiB
- **⚠️ MARGEN AJUSTADO** — Los resource limits codificados en docker-compose son CRÍTICOS. El swap de 4 GiB actúa como colchón. Se recomienda que el humano monitoree RAM en los primeros días de operación. En la práctica, no todos los servicios estarán en pico simultáneamente.

## Riesgos detectados

1. **RAM ajustada** — Con todos los servicios al máximo simultáneamente, el sistema dependería del swap. En operación normal (no todos en pico), debería funcionar. Los resource limits en docker-compose son la primera línea de defensa.
2. **System restart required pendiente** — El kernel tiene actualizaciones pendientes. No se reinicia (decisión del humano). Riesgo bajo a corto plazo.
3. **UFW inactivo** — No hay firewall a nivel OS. La protección es solo via GCP firewall rules. Aceptable; el humano decide si activar UFW.
4. **Docker instalará iptables rules** — Al instalar Docker, se agregarán reglas de iptables. Verificar post-instalación que Apache y Omada siguen respondiendo.

## Decisión de coexistencia con LAMP + Omada

- Apache sigue en :80/:443 sirviendo soporte.lamarque.mx (GLPI + otros)
- Omada sigue en sus puertos (8043/8088/8843/29811-29816)
- Caddy del stack Lighthouse solo escucha en 9080/9443 (sin competencia)
- **Exposición pública:** diferida al humano (ver ADR-004 para 3 opciones)
- Opción recomendada: Apache reverse-proxy a Caddy:9080 via nuevo VirtualHost en subdominio (ej. bot.lamarque.mx) — agrega site sin tocar los existentes
