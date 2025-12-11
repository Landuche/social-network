from io import BytesIO
from PIL import Image
from django.http import HttpRequest
from django.test import TestCase
from django.urls import reverse
from unittest.mock import patch
from network.utils import require_post, get_user, validate_content, validate_image, get_body_content, InvalidRequestBodyError
from network.models import Post, User
from django.core.exceptions import ValidationError

import json, pytest

class TestImageValidation:

    def test_invalid_image(self):
        fake = BytesIO(b"xxxxx")
        valid, error = validate_image(fake)
        assert not valid
        assert error == "Invalid image file."

    def test_unsupported_format(self):
        img = Image.new("RGB", (10, 10))
        buffer = BytesIO()
        img.save(buffer, format="GIF")
        buffer.seek(0)

        valid, error = validate_image(buffer)
        assert not valid
        assert "Unsupported" in error

    def test_too_big(self):
        img = Image.new("RGB", (10, 10))
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        with patch.object(buffer, "getvalue", return_value=b"x" * (6*1024*1024)):
            valid, error = validate_image(buffer)

        assert not valid
        assert error == "Image too big."

    def test_valid_png(self):
        img = Image.new("RGB", (10, 10))
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)

        valid, error = validate_image(buffer)
        assert valid
        assert error is None

class TestUtilsDatabase(TestCase):

    def setUp(self):
            from django.contrib.auth import get_user_model
            User = get_user_model()

            self.user1 = User.objects.create_user(username="test", password="123")
            self.client.login(username="test", password="123")

    def test_get_user_invalid_id_string(self):
        assert get_user("abc") is None

    def test_get_user_invalid_type(self):
        assert get_user(None) is None

    def test_get_user_not_found(self):
        assert get_user(999999) is None

    def test_validate_content_exceeds_length(self):
        content = "a" * 260
        valid, error = validate_content(content, length=250)
        assert not valid
        assert "exceeds" in error

    def test_get_body_content_invalid_json(self):
            post = Post.objects.create(user=self.user1, content="Test Post for Comment")
            
            # Invalid JSON
            malformed_payload = b"{'content': 'test',}" 
            
            # Use an endpoint that calls get_body_content
            response = self.client.post(
                reverse("create_comment", kwargs={"post_id": post.id}),
                malformed_payload,
                content_type="application/json"
            )
            
            self.assertEqual(response.status_code, 400)
            
            response_data = response.json()
            self.assertIn("Invalid JSON in request body", response_data["error"])

    def test_get_body_content_missing_field(self):
        request = HttpRequest()
        request.method = "POST"
        request._body = json.dumps({"other": "value"}).encode()

        with self.assertRaises(InvalidRequestBodyError):
            get_body_content(request, "content")

    def test_get_body_content_trim_all_fields(self):
        request = HttpRequest()
        request.method = "POST"
        request._body = json.dumps({
            "a": "   hello   ",
            "b": 123,
            "c": "   world"
        }).encode()

        data = get_body_content(request)

        assert data["a"] == "hello"
        assert data["c"] == "world"
        assert data["b"] == 123  # untouched non-string

    def test_require_http_methods_rejects_invalid(self):
        @require_post
        def sample_view(request):
            from django.http import JsonResponse
            return JsonResponse({"ok": True})

        request = HttpRequest()
        request.method = "GET"

        response = sample_view(request)

        assert response.status_code == 405
        assert "GET request required." in response.content.decode()

    def test_create_post_empty_content(self):
            url = reverse("create_post")
            # Empty string content
            payload = json.dumps({"content": ""}) 

            response = self.client.post(url, payload, content_type="application/json")
            
            self.assertEqual(response.status_code, 400) 

    @pytest.mark.django_db
    def test_clean_email_already_in_use(self):
        User.objects.create(username="u1", email="test@example.com")

        user2 = User(username="u2", email="TEST@example.com")  # case-insensitive duplicate

        with pytest.raises(ValidationError) as exc:
            user2.clean()

        assert "email" in exc.value.message_dict
        assert exc.value.message_dict["email"][0] == "Email already in use."
