"""
utils.py
Utility functions used across multiple view modules.
"""

from PIL import Image

from django.conf import settings
from django.http import JsonResponse
from django.templatetags.static import static
import json

from .models import User


def get_body_content(request, content_type=None):
    """
    Parse JSON data from the request body and optionally extract a specific field.
    Automatically trims leading/trailing whitespace from string values.

    Args:
        request (HttpRequest):
            The incoming Django request containing a JSON body.

        content_type (str, optional):
            If provided, return only this key from the parsed JSON.
            If omitted, return the full JSON object.

    Returns:
        Any | dict:
            - If content_type is provided:
                Returns the corresponding value (string values are auto-trimmed).
            - If content_type is omitted:
                Returns the full JSON payload with all string values auto-trimmed.

    Raises:
        KeyError:
            If content_type is provided but the key is missing in the request body.
        ValueError:
            If the request body is not valid JSON.

    Notes:
        - Non-string values (lists, dicts, booleans, numbers) are returned unchanged.
        - Empty request bodies return an empty dict.
    """
    try:
        data = json.loads(request.body) if request.body else {}
        if content_type:
            if content_type not in data:
                raise InvalidRequestBodyError(f"Missing required field: {content_type}")

            value = data[content_type]

            if isinstance(value, str):
                value = value.strip()

            return value

        for key, value in data.items():
            if isinstance(value, str):
                data[key] = value.strip()

        return data
    except json.JSONDecodeError:
        raise InvalidRequestBodyError("Invalid JSON in request body")


def get_user(user_id):
    """
    Retrieve a User instance by ID.

    Args:
        user_id (int | str): ID of the user to retrieve. Accepts string
        representations of integers for convenience.

    Returns:
        User | None:
            - User instance if found and valid.
            - None if the ID is invalid or the user does not exist.
    """
    try:
        user = User.objects.get(id=int(user_id))
    except (User.DoesNotExist, ValueError, TypeError):
        return None

    return user


def validate_image(image):
    """
    Validate an uploaded image file.

    Args:
        image (File): Uploaded image file.

    Returns:
        tuple[bool, str | None]:
            - True, None if the image is valid.
            - False, error message string if invalid.
    """
    try:
        img = Image.open(image)
        img.verify()
        image.seek(0)
    except (IOError, SyntaxError):
        return False, "Invalid image file."

    if img.format.lower() not in ["jpeg", "png"]:
        return False, f"Unsupported image format: {img.format}"

    try:
        image_size = image.size / (1024 * 1024)
    except AttributeError:
        image_size = len(image.getvalue()) / (1024 * 1024)

    if image_size > 5:
        return False, "Image too big."

    return True, None


def validate_content(content, length=250):
    """
    Validate content before creation or editing.

    Args:
        content (str)

    Returns:
        tuple: (is_valid (bool), error_message (str|None))
    """
    if not content or content.strip() == "":
        return False, "Content cannot be empty."

    if len(content) > length:
        return False, f"Content exceeds {length} characters."

    return True, None


def require_http_methods(methods):
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return JsonResponse(
                    {"error": f"{request.method} request required."}, status=405
                )
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


require_get = require_http_methods(["GET"])
require_post = require_http_methods(["POST"])
require_put = require_http_methods(["PUT"])
require_put_delete = require_http_methods(["PUT", "DELETE"])


class InvalidRequestBodyError(Exception):
    pass


def default_profile_picture(request):
    return {"DEFAULT_PROFILE_PICTURE": static(settings.DEFAULT_PROFILE_PICTURE)}


def default_profile_picture_dark(request):
    return {
        "DEFAULT_PROFILE_PICTURE_DARK": static(settings.DEFAULT_PROFILE_PICTURE_DARK)
    }
