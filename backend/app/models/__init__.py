"""ORM models package. Importing this module registers all tables."""

from app.models.base import Base
from app.models.scan import Analysis, Scan

__all__ = ["Base", "Scan", "Analysis"]
