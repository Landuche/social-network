"""
profiles.py
Views for handling user profile retrieval and actions.
"""

from django.http import JsonResponse
from django.db import transaction
from django.db.models import F
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError

from .utils import get_user, require_post, require_put, require_get


@require_get
def profile_view(request, id):
    """
    Retrieve profile information for a given user.

    Args:
        request (HttpRequest): Django request object containing the current user.
        id (int | str): The ID of the user whose profile is requested.

    Returns:
        JsonResponse:
            - On success: JSON containing user data.
            - On failure: JSON with error message and HTTP status.
    """
    user = get_user(id)
    if not user:
        return JsonResponse({"error": "User not found."}, status=404)

    is_following = False
    if request.user.is_authenticated:
        is_following = user.followers.filter(id=request.user.id).exists()

    return JsonResponse(
        {
            "username": user.username,
            "id": user.id,
            "profile_picture": (
                user.profile_picture_url if user.profile_picture else None
            ),
            "followers": user.followers_count,
            "following": user.following_count,
            "follow": is_following,
            "post_count": user.post_count,
        },
        status=200,
    )


@login_required
@require_post
@transaction.atomic
def edit_profile(request):
    """
    Update the logged-in user's profile.

    Args:
        request (HttpRequest): Django request object containing the current user and POST data.

    Returns:
        JsonResponse:
            - On success: {"success": True}.
            - On failure: JSON with error message and appropriate HTTP status.
    """
    user = request.user
    picture = request.FILES.get("profile_picture")
    if picture:
        user.profile_picture = picture

    username = request.POST.get("username")
    if username:
        user.username = username.strip()

    email = request.POST.get("email")
    if email:
        user.email = email.strip().lower()

    # Validate data
    try:
        user.full_clean()
        user.save()
    except ValidationError as error:
        field, messages = next(iter(error.message_dict.items()))
        return JsonResponse({"error": messages[0]}, status=409)

    return JsonResponse(
        {
            "success": True,
            "profile_picture": user.profile_thumbnail_url if picture else None,
        }
    )


@login_required
@require_get
def get_email(request, user_id):
    """
    Return the logged-in user's email.

    Args:
        request (HttpRequest): Django request object containing the current user.
        user_id (int | str): ID of the user whose email is requested.

    Returns:
        JsonResponse:
            - On success: JSON containing email.
            - On failure: JSON with error message and HTTP status.
    """
    user = request.user
    target_user = get_user(user_id)
    if user != target_user:
        return JsonResponse({"error": "Unauthorized."}, status=403)
    return JsonResponse({"email": user.email}, status=200)


@login_required
@require_put
def follow_view(request, id):
    """
    Handle follow/unfollow actions for a user.

    Args:
        request (HttpRequest): Django request object containing the current user data, if authenticated.
        id (int | str): The ID of the target user to follow or unfollow.

    Returns:
        JsonResponse:
            - On success: JSON containing current follow status and followers count.
            - On failure: JSON with error message and appropriate HTTP status.
    """
    target_user = get_user(id)
    if not target_user:
        return JsonResponse({"error": "User not found."}, status=404)

    user = request.user

    if target_user == user:  # pragma: no cover
        return JsonResponse({"error": "You cannot follow yourself."}, status=400)

    follow = user.toggle_follow(target_user)

    target_user.refresh_from_db()

    return JsonResponse(
        {"follow": follow, "followers_count": target_user.followers_count}, status=200
    )
