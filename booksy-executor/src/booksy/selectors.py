"""
Selectores de Booksy con cascada de fallback.
El humano debe completar los valores reales en la mañana inspeccionando
la UI de Booksy logueado como dueño.

Para cada elemento: el primer selector que matchee gana.
Orden: data-testid > role+name > text > CSS (más a menos estable).
"""
from dataclasses import dataclass, field
from typing import Any

from playwright.async_api import Page
import structlog

log = structlog.get_logger()

# ---------------------------------------------------------------------------
# Definición de selectores por elemento (completar con valores reales)
# ---------------------------------------------------------------------------

SELECTORS: dict[str, list[dict[str, Any]]] = {
    # Botón de login
    "login_button": [
        {"type": "role", "role": "button", "name": "Log in"},
        {"type": "text", "text": "Log in"},
        {"type": "css", "selector": "button[type='submit']"},
    ],
    # Campo de email en login
    "login_email": [
        {"type": "testid", "testid": "email"},  # TODO: verificar data-testid real
        {"type": "css", "selector": "input[type='email']"},
        {"type": "role", "role": "textbox", "name": "Email"},
    ],
    # Campo de password en login
    "login_password": [
        {"type": "testid", "testid": "password"},  # TODO: verificar data-testid real
        {"type": "css", "selector": "input[type='password']"},
        {"type": "role", "role": "textbox", "name": "Password"},
    ],
    # Botón "Nueva cita" o equivalente
    "new_appointment_button": [
        {"type": "testid", "testid": "new-appointment"},  # TODO
        {"type": "role", "role": "button", "name": "Nueva cita"},
        {"type": "role", "role": "button", "name": "New appointment"},
        {"type": "text", "text": "Nueva cita"},
    ],
    # Selector de servicio
    "service_selector": [
        {"type": "testid", "testid": "service-select"},  # TODO
        {"type": "role", "role": "combobox", "name": "Servicio"},
        {"type": "css", "selector": "[data-qa='service-selector']"},
    ],
    # Selector de fecha
    "date_picker": [
        {"type": "testid", "testid": "date-picker"},  # TODO
        {"type": "role", "role": "textbox", "name": "Fecha"},
        {"type": "css", "selector": "input[type='date']"},
    ],
    # Selector de hora (slots disponibles)
    "time_slot": [
        {"type": "testid", "testid": "time-slot"},  # TODO
        {"type": "role", "role": "button", "name": "Seleccionar hora"},
        {"type": "css", "selector": "[data-qa='time-slot']"},
    ],
    # Botón confirmar reserva
    "confirm_button": [
        {"type": "testid", "testid": "confirm-booking"},  # TODO
        {"type": "role", "role": "button", "name": "Confirmar"},
        {"type": "role", "role": "button", "name": "Confirm"},
        {"type": "text", "text": "Confirmar reserva"},
    ],
    # Disponibilidad (contenedor de slots)
    "availability_container": [
        {"type": "testid", "testid": "availability-grid"},  # TODO
        {"type": "css", "selector": "[data-qa='slots-grid']"},
        {"type": "role", "role": "grid"},
    ],
}


async def find_with_fallback(page: Page, element_key: str, timeout: int = 5000):
    """
    Intenta cada selector en orden hasta encontrar el elemento.
    Devuelve el Locator del primero que matchee, o lanza ValueError.
    """
    selectors = SELECTORS.get(element_key)
    if not selectors:
        raise ValueError(f"Unknown element key: {element_key}")

    last_error = None
    for sel in selectors:
        try:
            sel_type = sel["type"]
            if sel_type == "testid":
                locator = page.get_by_test_id(sel["testid"])
            elif sel_type == "role":
                kwargs = {k: v for k, v in sel.items() if k not in ("type", "role")}
                locator = page.get_by_role(sel["role"], **kwargs)
            elif sel_type == "text":
                locator = page.get_by_text(sel["text"], exact=False)
            elif sel_type == "css":
                locator = page.locator(sel["selector"])
            else:
                continue

            await locator.wait_for(timeout=timeout, state="visible")
            log.debug("selector.found", element=element_key, selector_type=sel_type)
            return locator

        except Exception as e:
            last_error = e
            log.debug("selector.miss", element=element_key, selector=sel, error=str(e))
            continue

    raise ValueError(f"All selectors failed for '{element_key}': {last_error}")
