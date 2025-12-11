import pytest
from django.urls import reverse
from django.test import TestCase

from django.contrib.auth import get_user_model
User = get_user_model()


@pytest.mark.django_db
class TestViews(TestCase):

    def setUp(self):
            self.user1 = User.objects.create_user(username="test", password="123")
            self.client.force_login(self.user1)

    def test_register_password_mismatch(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "john",
                "email": "john@example.com",
                "password": "123",
                "confirmation": "456",
            }
        )
        self.assertEqual(response.status_code, 409)

    def test_registration_error_paths(self):
            # Password Mismatch
            response_mismatch = self.client.post(reverse("register"), {
                "username": "charlie",
                "email": "charlie@example.com",
                "password": "pass1",
                "confirmation": "pass2"  # Different from password
            })
            
            self.assertEqual(response_mismatch.status_code, 409)
            
            # Duplicate Username 
            response_duplicate = self.client.post(reverse("register"), {
                "username": self.user1.username, 
                "email": "another@example.com",
                "password": "testpass",
                "confirmation": "testpass"
            })
            
            self.assertEqual(response_duplicate.status_code, 409)

    def test_index_view_renders(self):
        response = self.client.get(reverse("index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'div class="network-app"')

    def test_login_invalid_credentials(self):
        response = self.client.post(
            reverse("login"),
            {"username": "ghost", "password": "wrong"}
        )
        self.assertEqual(response.status_code, 400)
        

    def test_login_success(self):
        User.objects.create_user("john", "john@example.com", "123")

        response = self.client.post(
            reverse("login"),
            {"username": "john", "password": "123"}
        )

        self.assertEqual(response.status_code, 200)

@pytest.mark.django_db
def test_logout_view(client, django_user_model):
    # Log user in first
    user = django_user_model.objects.create_user(
        username="u", password="p", email="u@test.com"
    )
    client.login(username="u", password="p")

    assert "_auth_user_id" in client.session  # user is logged in

    response = client.get(reverse("logout"))

    assert response.status_code == 200
    assert "_auth_user_id" not in client.session  # logged out

@pytest.mark.django_db
def test_register_success(client):
    data = {
        "username": "newuser",
        "email": "new@test.com",
        "password": "abc12345",
        "confirmation": "abc12345",
    }

    response = client.post(reverse("register"), data)

    assert response.status_code == 200

    # User was created
    from network.models import User
    assert User.objects.filter(username="newuser").exists()

    # User is logged in
    assert "_auth_user_id" in client.session

from django.db import IntegrityError

@pytest.mark.django_db
def test_register_integrity_error(client, monkeypatch):
    # Force .save() to raise IntegrityError
    def fake_save(*args, **kwargs):
        raise IntegrityError()

    from network.models import User
    monkeypatch.setattr(User, "save", fake_save)

    data = {
        "username": "taken",
        "email": "x@test.com",
        "password": "123",
        "confirmation": "123",
    }

    response = client.post(reverse("register"), data)

    assert response.status_code == 409