"""
views.py
Main application views for the Network project.

- Handles user authentication.
- Renders the main index page.
- Minimal backend logic; dynamic content is handled via JavaScript on the frontend.
- Designed as entry point for the application.
"""

from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError
from django.shortcuts import render, redirect

from .models import User
from .utils import require_post


def index(request):
    """
    Render the main index page.
    - Entry point of the application.
    - JavaScript handles dynamic content loading here.
    """
    return render(request, "network/index.html")


@require_post
def login_view(request):
    """
    Handle user login.
    - GET: Render the login page.
    - POST: Authenticate user credentials and log in.
        - On success → redirect to index.
        - On failure → re-render login page with an error message.
    """
    username = request.POST.get("username").strip()
    password = request.POST.get("password").strip()

    user = authenticate(request, username=username, password=password)

    if user is not None:
        login(request, user)
        return JsonResponse(
            {
                "user_id": user.id,
                "username": user.username,
                "profile_picture": user.profile_thumbnail_url,
            },
            status=200,
        )

    return JsonResponse({"error": "Invalid username and/or password."}, status=400)


def logout_view(request):
    """
    Log the user out and redirect to the index page.
    """
    logout(request)
    return JsonResponse({"success": True}, status=200)


@require_post
def register(request):
    """
    Handle new user registration.
    - GET: Render the registration form.
    - POST:
        - Validate password confirmation.
        - Attempt to create a new user.
        - Handle errors.
        - Log user in automatically after successful registration.
    """
    from django.core.exceptions import ValidationError

    username = request.POST.get("username").strip()
    email = request.POST.get("email").strip().lower()

    # Add length check to password later
    password = request.POST.get("password").strip()
    confirmation = request.POST.get("confirmation").strip()
    picture = request.FILES.get("profile_picture")

    if password != confirmation:
        return JsonResponse({"error": "Passwords must match."}, status=409)

    # Validate user data
    try:
        user = User(username=username, email=email, profile_picture=picture)
        user.set_password(password)
        user.full_clean()
        user.save()
        login(request, user)
        return JsonResponse(
            {
                "user_id": user.id,
                "username": user.username,
                "profile_picture": user.profile_thumbnail_url,
            },
            status=200,
        )
    except ValidationError as error:
        field = next(iter(error.message_dict))
        message = error.message_dict[field][0]
        return JsonResponse({"error": message}, status=409)
    except IntegrityError as error:
        error_message = str(error).lower()
        return JsonResponse({"error": error_message}, status=409)
