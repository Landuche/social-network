from django.test import TestCase
from django.contrib.auth import get_user_model
from network.models import Post
from datetime import datetime, timedelta, timezone

User = get_user_model()

BASE_TIMESTAMP = datetime(2025, 11, 30, 12, 0, 0, tzinfo=timezone.utc)

class BaseNetworkTest(TestCase):

    @classmethod
    def setUpTestData(cls):
        # Create two users
        cls.user1 = User.objects.create_user(username="alice", email="alice@example.com", password="test123")
        cls.user2 = User.objects.create_user(username="bob",   email="bob@example.com",   password="test123")

        # Create 30 posts
        for i in range(30):
            Post.objects.create(
                user=cls.user1,
                content=f"Post {i+1}",
                timestamp= BASE_TIMESTAMP - timedelta(seconds=i)
            )

        # Cursors
        all_posts = Post.objects.order_by("-timestamp", "-id")
        cls.first_post = all_posts[0]
        cls.first_page_last_post = all_posts[9]   # 10th post (0-indexed)
        cls.second_page_last_post = all_posts[19]
        cls.last_post = all_posts[29]

    def setUp(self):
        self.client.force_login(self.user1)
        self.user1 = User.objects.get(pk=self.user1.pk)
        self.user2 = User.objects.get(pk=self.user2.pk)

        # Cursors
        cls = self.__class__
        self.first_post = Post.objects.get(id=cls.first_post.id)
        self.first_page_last_post = Post.objects.get(id=cls.first_page_last_post.id)
        self.second_page_last_post = Post.objects.get(id=cls.second_page_last_post.id)
        self.last_post = Post.objects.get(id=cls.last_post.id)
