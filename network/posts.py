"""
posts.py
Views and helper functions for posts.
"""

from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Prefetch, F, Q
from django.utils.dateparse import parse_datetime
from .models import Post

from .utils import (
    get_body_content,
    get_user,
    validate_content,
    require_post,
    require_put_delete,
    require_get,
    InvalidRequestBodyError,
)

POST_LIMIT = 10

User = get_user_model()


@require_get
def posts_view(request, filter):
    """
    Retrieve posts based on the specified filter, and serialize for JSON response.

    Args:
        request (HttpRequest): The Django request object.
        filter (str): Filter type.

    Returns:
        JsonResponse:
            - JSON with serialized posts, pagination info, and like status, if authenticated.
            - JSON with error message and status if filter fails or user unauthenticated.
    """
    error, posts_qs, status = get_posts(request, filter)
    if error:
        return JsonResponse({"error": error}, status=status)

    _, has_next, return_posts = paginate_posts(posts_qs)

    if not return_posts:
        return JsonResponse({"posts": [], "hasNext": False}, status=200)

    return JsonResponse(
        {
            "posts": [post.serialize(request.user) for post in return_posts],
            "hasNext": has_next,
        },
        status=200,
    )


def get_posts(request, filter):
    """
    Retrieve posts.

    Args:
        request (HttpRequest): Django request object, may contain 'user_id' in GET for 'profile' filter.
        filter (str): Filter type.

    Returns:
        tuple: (error (str|None), posts (QuerySet), status (int))
    """
    error = None
    status = 200
    posts = Post.objects.all().select_related("user")

    match filter:
        case "following":
            if request.user.is_authenticated:
                posts = posts.filter(user__followers=request.user)
            else:
                error = "User not authenticated."
                status = 401

        case "all":
            pass

        case "profile":
            user = get_user(request.GET.get("user_id"))
            if user:
                posts = posts.filter(user=user)
            else:
                error = "User not found."
                status = 404

        case _:
            error = "Filter not found."
            status = 404

    if request.user.is_authenticated and status == 200:
        posts = posts.prefetch_related(
            Prefetch(
                "likes",
                queryset=User.objects.filter(id=request.user.id),
                to_attr="_liked_by_user",
            )
        )

    return error, posts if status == 200 else Post.objects.none(), status


@login_required
@require_put_delete
def update_post(request, post_id):
    """
    Handle update actions for a post: like, edit, delete.

    Args:
        request (HttpRequest): Must be PUT or DELETE request with JSON body containing 'action'.
        post_id (int): ID of the post to update.

    Returns:
        JsonResponse:
            - Success or error message depending on action result.
            - HTTP 400 if unauthorized, missing parameters, or invalid action.
    """
    try:
        post = Post.objects.get(id=post_id)
    except Post.DoesNotExist:
        return JsonResponse({"error": "Post does not exist."}, status=400)

    try:
        action = get_body_content(request, "action")
    except InvalidRequestBodyError as e:
        return JsonResponse({"error": str(e)}, status=400)

    if action == "like":
        liked = post.like_post(request.user)
        return JsonResponse({"liked": liked, "like_count": post.like_count}, status=200)

    elif action == "edit":
        edited, message, status = edit_post(request, post)
        if not edited:
            return JsonResponse({"error": message}, status=status)
        return JsonResponse(
            {"message": message, "content": post.content}, status=status
        )

    elif action == "delete":
        if post.user != request.user:
            return JsonResponse({"error": "Unauthorized."}, status=403)

        post.delete_post()

        return JsonResponse({"message": "Post deleted."}, status=200)

    else:
        return JsonResponse({"error": f"Invalid action: {action}"}, status=400)


def edit_post(request, post):
    """
    Edit an existing post if the authenticated user is the creator.

    Args:
        request (HttpRequest): Request object containing 'content'.
        post (Post): Post instance to edit.

    Returns:
        tuple: (success (bool), message (str), status(int))
            - success: True if edited, False if unauthorized or validation failed.
            - message: Description of result.
            - status: Status code.
    """
    if post.user != request.user:
        return False, "Unauthorized.", 403

    try:
        content = get_body_content(request, "content")
    except InvalidRequestBodyError as error:
        return False, str(error), 400

    is_valid, error = validate_content(content)

    if not is_valid:
        return False, error, 400

    post.content = content
    post.save()

    return True, "Post edited.", 200


@login_required
@require_post
def create_post(request):
    """
    Create a new post by the authenticated user.

    Args:
        request (HttpRequest): Must be POST request with JSON body containing 'content'.

    Returns:
        JsonResponse:
            - On success: message and post ID, status 201.
            - On failure: error message, status 400.
    """
    try:
        content = get_body_content(request, "content")
    except InvalidRequestBodyError as error:
        return JsonResponse({"error": str(error)}, status=400)

    is_valid, error = validate_content(content)
    if not is_valid:
        return JsonResponse({"error": error}, status=400)

    post = Post(user=request.user, content=content)

    post.save_post()

    data = post.serialize(request.user)
    data["liked"] = False

    return JsonResponse({"postData": data}, status=201)


@require_get
def get_more_posts(request, filter):
    timestamp = request.GET.get("timestamp")
    post_id = request.GET.get("post_id")

    error, posts_qs, status = get_posts(request, filter)
    if error:
        return JsonResponse({"error": error}, status=status)

    error, has_next, return_posts = paginate_posts(posts_qs, timestamp, post_id)
    if error:
        return JsonResponse({"error": error}, status=400)

    if not return_posts:
        return JsonResponse({"posts": [], "hasNext": False}, status=204)

    return JsonResponse(
        {
            "posts": [post.serialize(request.user) for post in return_posts],
            "hasNext": has_next,
        },
        status=200,
    )


def paginate_posts(posts_qs, timestamp=None, post_id=None):
    posts = posts_qs.order_by("-timestamp", "-id")

    if timestamp and post_id:
        try:
            timestamp = parse_datetime(timestamp)
            post_id = int(post_id)
            posts = posts.filter(
                Q(timestamp__lt=timestamp) | Q(timestamp=timestamp, id__lt=post_id)
            )
        except:
            return {
                "error": "Error parsing post data.",
                "has_next": None,
                "return_posts": None,
            }

    fetched = list(posts[: POST_LIMIT + 1])
    has_next = len(fetched) > POST_LIMIT
    return_posts = fetched[:POST_LIMIT]

    return None, has_next, return_posts
