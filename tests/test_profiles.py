from django.urls import reverse
from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch, PropertyMock, Mock
from base import BaseNetworkTest
from versatileimagefield.fields import VersatileImageFieldFile
from network.models import User

import base64, pytest

MINIMAL_PNG = base64.b64decode(
    b'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)

class TestProfile(BaseNetworkTest):

    def test_profile_view(self):
        url = reverse("profile", kwargs={"id": self.user2.id})
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["username"], "bob")

    @patch('network.models.User.profile_thumbnail_url', new_callable=PropertyMock)
    @patch('network.models.User.profile_picture_url', new_callable=PropertyMock)
    def test_picture_upload(self, mock_pic, mock_thumb):
        mock_thumb.return_value = "/media/profile_pics/mocked/100.png"
        mock_pic.return_value = "/media/profile_pics/mocked/default.png"

        f = SimpleUploadedFile("avatar.png", MINIMAL_PNG, content_type="image/png")

        r = self.client.post(reverse("edit_profile"), {
            "username": "newname",
            "email": "new@example.com",
            "profile_picture": f
        })

        self.assertEqual(r.status_code, 200)

    def test_follow_unfollow(self):
        url = reverse("follow", kwargs={"id": self.user2.id})
        
        # FOLLOW
        r1 = self.client.put(url, content_type="application/json")
        self.assertEqual(r1.status_code, 200)
        self.assertTrue(r1.json()["follow"])

        self.user1.refresh_from_db()
        self.user2.refresh_from_db()
        self.assertEqual(self.user1.following_count, 1) # User 1 followed 1 person
        self.assertEqual(self.user2.followers_count, 1) # User 2 gained 1 follower

        # UNFOLLOW
        r2 = self.client.put(url, content_type="application/json")
        self.assertEqual(r2.status_code, 200)
        self.assertFalse(r2.json()["follow"])

        self.user1.refresh_from_db()
        self.user2.refresh_from_db()
        self.assertEqual(self.user1.following_count, 0) # User 1 unfollowed
        self.assertEqual(self.user2.followers_count, 0) # User 2 lost follower

    def test_self_follow(self):
        url = reverse("follow", kwargs={"id": self.user1.id})

        r = self.client.put(url, content_type="application/json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("error", r.json())

    def test_self_follow_models(self):
        result = self.user1.toggle_follow(target_user=self.user1)

        self.assertFalse(result)

        self.user1.refresh_from_db()
        self.assertEqual(self.user1.following_count, 0)

    def test_follow_incorrect_user(self):
        url = reverse("follow", kwargs={"id": 987654321})

        r = self.client.put(url, content_type="application/json")
        self.assertEqual(r.status_code, 404)
        self.assertIn("error", r.json())

    def test_profile_incorrect_user(self):
        url = reverse("profile", kwargs={"id": 987654321})

        r = self.client.get(url)
        self.assertEqual(r.status_code, 404)
        self.assertIn("error", r.json())

    @patch('network.models.User.profile_thumbnail_url', new_callable=PropertyMock)
    @patch('network.models.User.profile_picture_url', new_callable=PropertyMock)
    def test_profile_picture_upload_and_thumbnail(self, mock_pic_url, mock_thumb_url):
        mock_thumb_url.return_value = '/media/profile_pics/mocked/avatar_100x100.png'
        mock_pic_url.return_value = '/media/profile_pics/mocked/default.png'

        image = SimpleUploadedFile("avatar.png", MINIMAL_PNG, content_type="image/png")

        response = self.client.post(
            reverse("edit_profile"),
            {
                "username": "alice_new",
                "email": "alice_new@example.com",
                "profile_picture": image
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, 200)
        self.user1.refresh_from_db()

        self.assertTrue(self.user1.profile_picture)
        self.assertTrue(str(self.user1.profile_picture).endswith(".png"))
        self.assertIn("profile_pics", str(self.user1.profile_picture))

        thumb_url = self.user1.profile_thumbnail_url
        self.assertIn("100x100", thumb_url)
        
        # Test fallback
        old_pic = self.user1.profile_picture
        old_pic.delete(save=True)
        self.assertIn("default", self.user1.profile_picture_url)

    def test_profile_picture_fallback(self):
        mock_storage = Mock(spec=FileSystemStorage) 
        mock_storage.exists.return_value = False
        
        with patch('network.models.default_storage', new=mock_storage):
            
            self.user1.profile_picture = SimpleUploadedFile("pic.jpg", b"dummy content")
            self.user1.save()
            
            url = reverse("profile", kwargs={"id": self.user1.id})
            response = self.client.get(url)
            data = response.json()

            self.assertIn("", data["profile_picture"])
            mock_storage.exists.assert_called_once()

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

    def test_edit_profile_validation_error_username(self):
        invalid_username = "a" * 151  

        image = SimpleUploadedFile("avatar.png", MINIMAL_PNG, content_type="image/png")

        response = self.client.post(
            reverse("edit_profile"),
            data={
                "username": invalid_username,
                "email": "valid@email.com",
                "profile_picture": image
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, 409)
        self.assertIn("error", response.json())

        self.user1.refresh_from_db()
        self.assertNotEqual(self.user1.username, invalid_username)


    def test_edit_profile_validation_error_email(self):
        response = self.client.post(
            reverse("edit_profile"),
            data={
                "username": "newname",
                "email": "email",
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, 409)
        data = response.json()
        self.assertIn("email", data["error"].lower() or "valid" in data["error"].lower())


    def test_edit_profile_success_without_picture(self):
        response = self.client.post(
            reverse("edit_profile"),
            data={
                "username": "alice_updated",
                "email": "alice.updated@example.com",
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"success": True, 'profile_picture': None})

        self.user1.refresh_from_db()
        self.assertEqual(self.user1.username, "alice_updated")
        self.assertEqual(self.user1.email, "alice.updated@example.com")


    def test_get_email_unauthorized(self):
        response = self.client.get(reverse("get_email", kwargs={"user_id": self.user2.id}))
        self.assertEqual(response.status_code, 403)
        self.assertIn("Unauthorized", response.json()["error"])


    def test_get_email_success(self):
        url_reverse = reverse("get_email", kwargs={"user_id": self.user1.id})
        self.assertIn(str(self.user1.id), url_reverse)
        self.assertIn("/email", url_reverse)

        response = self.client.get(url_reverse)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], self.user1.email)

        response_js_style = self.client.get(f"/user/{self.user1.id}/email")
        self.assertEqual(response_js_style.status_code, 200)
        self.assertEqual(response_js_style.json()["email"], self.user1.email)


@pytest.mark.django_db(transaction=True)
def test_get_profile_picture_url_thumbnail_branch():
    user = User.objects.create(username="thumb", email="t@test.com")

     # Assign fake profile picture 
    file = SimpleUploadedFile("pic.png", b"x", content_type="image/png") 
    user.profile_picture = file

    # Fake thumbnail entry
    thumb = Mock()
    thumb.name = "thumb_50.png"
    thumb.url = "/media/thumb_50.png" 
    user.profile_picture.thumbnail = {"50x50": thumb} 

    with patch("network.models.default_storage.exists", return_value=True):
        url = user.get_profile_picture_url(thumbnail=True, size="50x50")
    assert url == "/media/__sized__/pic-thumbnail-50x50.png"

@pytest.mark.django_db(transaction=True)
def test_get_profile_picture_url_main_branch(monkeypatch):
    user = User.objects.create(username="url", email="u@test.com")

    # Create a real file
    file = SimpleUploadedFile("main.png", b"abc", content_type="image/png")
    user.profile_picture = file
    user.save()

    # fake file exists
    monkeypatch.setattr(
        "network.models.default_storage.exists",
        lambda name: True
    )

    file_class = type(user.profile_picture)

    monkeypatch.setattr(
        file_class,
        "url",
        "/media/profile_pics/main.png",
        raising=False
    )

    url = user.get_profile_picture_url(thumbnail=False)

    assert url == "/media/profile_pics/main.png"

@pytest.mark.django_db(transaction=True)
def test_delete_previous_picture_signal_throws_error(monkeypatch):
    old_file = SimpleUploadedFile("old.png", b"aaa")
    user = User.objects.create(
        username="p", email="p@test.com", profile_picture=old_file
    )   
    old_picture_path = user.profile_picture.name

    new_file = SimpleUploadedFile("new.png", b"bbb")

    with patch.object(VersatileImageFieldFile, "delete", autospec=True) as mock_delete:
        mock_delete.side_effect = PermissionError

        user.profile_picture = new_file
        user.save()

        mock_delete.assert_called_once()

        user.refresh_from_db()
        assert user.profile_picture.name != old_picture_path

@pytest.mark.django_db(transaction=True)
def test_delete_previous_picture_signal_deletes_old_image(monkeypatch):
    # Create initial user with profile pic
    old_file = SimpleUploadedFile("old.png", b"aaa")
    user = User.objects.create(
        username="p", email="p@test.com", profile_picture=old_file
    )

    # Assign a new picture to trigger replacement
    new_file = SimpleUploadedFile("new.png", b"bbb")

    with patch.object(VersatileImageFieldFile, "delete", autospec=True) as mock_delete, \
            patch.object(VersatileImageFieldFile, "delete_all_created_images", autospec=True) as mock_delete_all:

            user.profile_picture = new_file
            user.save()

            mock_delete_all.assert_called_once()
            mock_delete.assert_called_once()

@pytest.mark.django_db(transaction=True)
def test_clean_invalid_profile_picture_raises():
    user = User.objects.create(username="img", email="img@test.com")

    file = SimpleUploadedFile("bad.png", b"x", content_type="image/png")
    user.profile_picture = file

    with patch("network.models.default_storage.exists", return_value=True), \
         patch("network.utils.validate_image", return_value=(False, "Bad image")):

        with pytest.raises(ValidationError) as exc:
            user.full_clean()

    assert "profile_picture" in exc.value.message_dict
    assert exc.value.message_dict["profile_picture"][0] == "Bad image"