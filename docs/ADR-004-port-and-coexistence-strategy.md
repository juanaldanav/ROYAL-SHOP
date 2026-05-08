# ADR-004 — Estrategia de Puertos y Coexistencia

**Fecha:** 2026-05-07  
**Estado:** Aceptado

---

## Contexto

La VM ya tiene Apache (80/443), MariaDB (3306), Omada Controller (8043/8088/8843) y telemetría GCP (20201/20202). Hay que desplegar el stack Lighthouse sin interferir con nada existente.

## Decisión de puertos

Todos los servicios internos del stack se exponen en loopback (`127.0.0.1`) en puertos altos, lejos de los usados:

| Servicio | Puerto host | Bind |
|---|---|---|
| Caddy HTTP | 9080 | 0.0.0.0 |
| Caddy HTTPS | 9443 | 0.0.0.0 |
| Postgres | 5433 | 127.0.0.1 |
| Redis | 6380 | 127.0.0.1 |
| n8n | 5678 | 127.0.0.1 |
| Evolution API | 8001 | 127.0.0.1 |
| Chatwoot web | 3001 | 127.0.0.1 |
| booksy-executor | 8002 | 127.0.0.1 |

Caddy es el único expuesto a `0.0.0.0` pero en puertos 9080/9443 (no compiten con Apache).

**Verificado:** todos los puertos estaban libres al 2026-05-07T23:40.

## Opciones de exposición pública

El stack actualmente es accesible solo en loopback (o vía SSH tunnel). Para que los clientes WhatsApp del mundo real lleguen al bot, el humano debe elegir una de estas opciones:

### Opción A — Apache reverse-proxy a Caddy (RECOMENDADA)

Agregar un nuevo VirtualHost en Apache que proxy-pase a Caddy:9080/9443.

```apache
<VirtualHost *:80>
    ServerName bot.lamarque.mx
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:9080/
    ProxyPassReverse / http://127.0.0.1:9080/
</VirtualHost>
```

Con SSL (Let's Encrypt para `bot.lamarque.mx`):
```bash
sudo certbot --apache -d bot.lamarque.mx
```

**Ventajas:** No toca los sites existentes. Apache maneja el SSL público. Caddy queda interno.  
**Requisito:** DNS `bot.lamarque.mx → IP pública de la VM` configurado primero.  
**Riesgo:** Bajo. Es un site nuevo, no modifica los existentes.

### Opción B — Cloudflare Tunnel

Instalar `cloudflared` en la VM y crear un tunnel que apunte a `http://localhost:9080`.

```bash
# En la VM:
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create lighthouse
cloudflared tunnel route dns lighthouse bot.tudominio.com
cloudflared tunnel run lighthouse
```

**Ventajas:** No toca Apache en absoluto. Maneja TLS automáticamente. Funciona detrás de NAT.  
**Desventajas:** Dependencia de Cloudflare. Requiere cuenta CF y dominio en CF.

### Opción C — Mover Caddy a puertos 80/443 (NO RECOMENDADA)

Requeriría apagar Apache. **No hacer mientras Apache sirva producción.**

## Decisión actual

Diferida al humano. La Opción A es la más conservadora y recomendada dado que ya se tiene Apache con Let's Encrypt funcionando.

## Notas para el humano

- Antes de A: asegúrate de que `mod_proxy` y `mod_proxy_http` estén activos en Apache:
  ```bash
  sudo a2enmod proxy proxy_http
  sudo systemctl restart apache2
  ```
- El webhook de Evolution API necesita ser accesible públicamente (n8n webhook URL). Asegúrate de que la URL configurada en Evolution apunte al dominio público correcto.
