from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

# Register your models here.


class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Profile Info", {"fields": ("profile_picture", "followers")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Profile Info", {"fields": ("profile_picture",)}),
    )


admin.site.register(User, UserAdmin)
