# booksy-executor

Microservicio Python/FastAPI que automatiza Booksy con Playwright.

## Endpoints

| Método | Ruta | Estado |
|---|---|---|
| GET | `/health` | Funcional |
| GET | `/availability?location=1&service=Corte&date_from=ISO&date_to=ISO` | Stub |
| POST | `/book` | Stub |
| POST | `/reschedule` | Stub |
| POST | `/cancel` | Stub |

Los endpoints stub retornan `{"status": "not_implemented", "reason": "awaiting_selectors"}`.

## Para completar en la mañana

1. Editar `src/booksy/selectors.py` — llenar los `# TODO` con los selectores reales
   de la UI de Booksy (inspeccionar con DevTools logueado como dueño).
2. Implementar `src/booksy/availability.py`, `booking.py` usando `find_with_fallback`.
3. Generar storage_state inicial:
   ```bash
   # En la VM, con el stack corriendo:
   docker compose exec booksy-executor python -c "
   import asyncio
   from booksy.browser import get_context, save_session
   from booksy.login import ensure_logged_in
   from config import settings
   async def main():
       ctx = await get_context('suc1')
       await ensure_logged_in(ctx, 'suc1', settings.booksy_username_suc1, settings.booksy_password_suc1)
       await save_session('suc1')
   asyncio.run(main())
   "
   ```

## Tests

```bash
uv run pytest tests/ -v
```
