class BooksyError(Exception):
    """Base para errores del executor."""


class BooksyLoginError(BooksyError):
    """Falló el login a Booksy."""


class BooksySelectorError(BooksyError):
    """No se encontró un elemento esperado en la UI."""


class BooksyNotAvailableError(BooksyError):
    """El slot solicitado ya no está disponible."""


class BooksyBookingError(BooksyError):
    """Error durante el proceso de reserva."""
