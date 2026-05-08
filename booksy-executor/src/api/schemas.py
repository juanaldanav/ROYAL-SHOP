from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AvailabilityRequest(BaseModel):
    location: str  # "1" o "2" para las sucursales configuradas
    service: str
    date_from: datetime
    date_to: datetime


class BookRequest(BaseModel):
    location: str
    service: str
    slot_datetime: str  # ISO 8601
    client_name: str
    client_phone: str


class RescheduleRequest(BaseModel):
    location: str
    appointment_id: str
    new_slot_datetime: str  # ISO 8601


class CancelRequest(BaseModel):
    location: str
    appointment_id: str


class HealthResponse(BaseModel):
    status: str
    browser_ready: bool
    circuit_breakers: dict[str, str]
