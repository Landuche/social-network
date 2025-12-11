"""
comments.py
Views for handling comment retrieval, creation, and updates.
"""

from .models import Comment, Post
from django.db import transaction
from django.db.models import F
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from .utils import (
    get_body_content,
    validate_content,
    require_post,
    require_put_delete,
    require_get,
    InvalidRequestBodyError,
)


@require_get
def comments_view(request, post_id):
    """
    Retrieve all comments for a given post, ordered by timestamp descending.

    Args:
        request (HttpRequest): The Django request object.
        post_id (int | str): The ID of the post whose comments are requested.

    Returns:
        JsonResponse:
            - On success: JSON containing a list of serialized comments, status 200.
            - On failure (wrong method): JSON with error message, status 400.
    """
    comments = Comment.objects.filter(post_id=post_id).order_by("-timestamp")
    return JsonResponse(
        {"comments": [comment.serialize(user=request.user) for comment in comments]},
        status=200,
    )


@login_required
@require_post
def create_comment(request, post_id):
    """
    Create a new comment for a specific post.

    Args:
        request (HttpRequest): The Django request object containing JSON data with the comment content.
        post_id (int | str): The ID of the post to comment on.

    Returns:
        JsonResponse:
            - On success: JSON containing the serialized comment, updated comment count, status 201.
            - On failure:
                - Missing or invalid content: JSON with error message, status 400.
                - Post does not exist: JSON with error message, status 400.
                - Wrong request method: JSON with error message, status 400.
            - Requires authentication (login_required).
    """
    try:
        content = get_body_content(request, "content")
    except InvalidRequestBodyError as error:
        return JsonResponse({"error": str(error)}, status=400)

    is_valid, error = validate_content(content, 100)
    if not is_valid:
        return JsonResponse({"error": error}, status=400)

    try:
        post = Post.objects.get(id=post_id)
    except Post.DoesNotExist:
        return JsonResponse({"error": "Post does not exist."}, status=400)

    comment = Comment(user=request.user, post=post, content=content)

    comment.save_comment()

    return JsonResponse(
        {
            "message": "Comment created.",
            "comment": comment.serialize(user=request.user),
            "commentCount": post.comment_count,
        },
        status=201,
    )


@login_required
@require_put_delete
def update_comment(request, comment_id):
    """
    Update or delete a comment, based on the action specified in the request body.

    Args:
        request (HttpRequest): The Django request object containing JSON data with the action ('edit' or 'delete') and optionally 'content'.
        comment_id (int | str): The ID of the comment to update or delete.

    Returns:
        JsonResponse:
            - On success:
                - Edit action: JSON containing updated content, status 200.
                - Delete action: JSON containing updated comment count, status 200.
            - On failure:
                - Unauthorized action: JSON with error message, status 403.
                - Missing or invalid content/action: JSON with error message, status 400.
                - Comment does not exist: JSON with error message, status 400.
                - Wrong request method: JSON with error message, status 400.
            - Requires authentication (login_required).
    """
    try:
        comment = Comment.objects.get(id=comment_id)
    except Comment.DoesNotExist:
        return JsonResponse({"error": "Comment does not exist."}, status=400)

    try:
        action = get_body_content(request, "action")
    except InvalidRequestBodyError as e:
        return JsonResponse({"error": str(e)}, status=400)

    if action == "delete":
        if comment.user != request.user:
            return JsonResponse({"error": "Unauthorized."}, status=403)

        comment.delete_comment()

        return JsonResponse(
            {"message": "Comment deleted.", "commentCount": comment.post.comment_count},
            status=200,
        )

    if action == "edit":
        try:
            content = get_body_content(request, "content")
        except InvalidRequestBodyError as error:
            return JsonResponse({"error": str(error)}, status=400)

        is_valid, error = validate_content(content, 100)
        if not is_valid:
            return JsonResponse({"error": error}, status=400)

        comment.content = content
        comment.save()
        return JsonResponse(
            {"message": "Comment edited.", "content": comment.content}, status=200
        )

    else:
        return JsonResponse({"error": f"Invalid action: {action}"}, status=400)
