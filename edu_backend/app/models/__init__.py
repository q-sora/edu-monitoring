"""
Импортируя этот пакет, регистрируем все ORM-классы в Base.registry.
Это критично для скриптов (create_superadmin, seed_data), которые
иначе загружают только часть моделей и падают на relationship() резолве.
"""
from app.models.user         import User, RefreshToken, UserRoleEnum
from app.models.organization import (
    Organization, OrgType, Region, Locality, OwnershipForm,
)
from app.models.science      import ScienceActivity
from app.models.contingent   import ContingentSnapshot
from app.models.finance      import FinanceRecord
from app.models.graduates    import GraduatesRecord
from app.models.education    import EducationalProcess

__all__ = [
    "User", "RefreshToken", "UserRoleEnum",
    "Organization", "OrgType", "Region", "Locality", "OwnershipForm",
    "ScienceActivity", "ContingentSnapshot", "FinanceRecord",
    "GraduatesRecord", "EducationalProcess",
]
