from django.urls import reverse
from network.models import Post
import json
from base import BaseNetworkTest

class TestPosts(BaseNetworkTest):

    def test_create_post(self):
        url = reverse("create_post")
        payload = json.dumps({"content": "test create post"})

        res = self.client.post(url, payload, content_type="application/json")

        self.assertEqual(res.status_code, 201)
        self.assertEqual(Post.objects.count(), 31)
        self.assertEqual(Post.objects.order_by("-id").first().content, "test create post")

    def test_edit_post(self):
        post = Post.objects.create(user=self.user1, content="orig")
        url = reverse("update_post", kwargs={"post_id": post.id})

        res = self.client.put(url, json.dumps({"action": "edit", "content": "new"}), content_type="application/json")

        self.assertEqual(res.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.content, "new")

    def test_delete_post(self):
        post = Post.objects.create(user=self.user1, content="del")
        post.save_post()

        self.user1.refresh_from_db()

        initial = self.user1.post_count
        url = reverse("update_post", kwargs={"post_id": post.id})

        res = self.client.delete(url, json.dumps({"action": "delete"}), content_type="application/json")

        self.assertEqual(res.status_code, 200)
        self.assertFalse(Post.objects.filter(id=post.id).exists())
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.post_count, initial - 1)

    def test_infinite_scroll_complete_flow(self):
        # First load
        resp = self.client.get(reverse("posts", kwargs={"filter": "all"}))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["hasNext"])

        resp = self.client.get(reverse("get_more_posts", kwargs={"filter": "all"}), {
            "timestamp": self.first_page_last_post.timestamp.isoformat(),
            "post_id": self.first_page_last_post.id
        })
        self.assertTrue(resp.json()["hasNext"])

        resp = self.client.get(reverse("get_more_posts", kwargs={"filter": "all"}), {
            "timestamp": self.second_page_last_post.timestamp.isoformat(),
            "post_id": self.second_page_last_post.id
        })
        self.assertFalse(resp.json()["hasNext"])

        final = self.client.get(reverse("get_more_posts", kwargs={"filter": "all"}), {
            "timestamp": self.last_post.timestamp.isoformat(),
            "post_id": self.last_post.id
        })
        self.assertEqual(final.status_code, 204)

    def test_like_and_unlike_post(self):
        post = Post.objects.create(user=self.user1, content="Like test")
        base_count = post.like_count

        self.client.put(reverse("update_post", kwargs={"post_id": post.id}),
                        json.dumps({"action": "like"}), content_type="application/json")
        post.refresh_from_db()
        self.assertEqual(post.like_count, base_count + 1)

        self.client.put(reverse("update_post", kwargs={"post_id": post.id}),
                        json.dumps({"action": "like"}), content_type="application/json")
        post.refresh_from_db()
        self.assertEqual(post.like_count, base_count)

    def test_cannot_edit_others_post(self):
        post = Post.objects.create(user=self.user2, content="post")
        Post.objects.create(user=self.user2, content="post")
        url = reverse("update_post", kwargs={"post_id": post.id})

        response = self.client.put(
            url,
            json.dumps({"action": "edit", "content": "Hacked!"}),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 403)
        post.refresh_from_db()
        self.assertEqual(post.content, "post")  # unchanged

    def test_posts_all_filter(self):
        response = self.client.get(reverse("posts", kwargs={"filter": "all"}))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(len(data["posts"]) >= 10)
        self.assertIn("hasNext", data)

    def test_posts_following_filter_authenticated(self):
        # Make alice follow bob
        self.user1.following.add(self.user2)
        Post.objects.create(user=self.user2, content="Bob's visible post")

        response = self.client.get(reverse("posts", kwargs={"filter": "following"}))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["posts"]), 1)  # only Bob's post

    def test_posts_view_invalid_filter(self):
        response = self.client.get(reverse("posts", kwargs={"filter": "hack_the_planet"}))
        self.assertEqual(response.status_code, 404)
        self.assertIn("Filter not found", response.json()["error"])

    def test_posts_following_filter_unauthenticated(self):
        self.client.logout()
        response = self.client.get(reverse("posts", kwargs={"filter": "following"}))
        self.assertEqual(response.status_code, 401)
        self.assertIn("not authenticated", response.json()["error"].lower())


    def test_posts_profile_filter_user_not_found(self):
        response = self.client.get(
            reverse("posts", kwargs={"filter": "profile"}),
            {"user_id": 99999}
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn("User not found", response.json()["error"])


    def test_posts_view_no_posts_returns_empty(self):
        Post.objects.all().delete() 
        response = self.client.get(reverse("posts", kwargs={"filter": "all"}))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["posts"], [])
        self.assertFalse(data["hasNext"])


    def test_get_more_posts_missing_params(self):
        response = self.client.get(reverse("get_more_posts", kwargs={"filter": "all"}))
        self.assertEqual(response.status_code, 200)


    def test_get_more_posts_invalid_timestamp_or_id(self):
        response = self.client.get(
            reverse("get_more_posts", kwargs={"filter": "all"}),
            {"timestamp": "data-que-nao-existe", "post_id": "abc"}
        )
        self.assertEqual(response.status_code, 400)

    def test_create_post_missing_content(self):
        response = self.client.post(
            reverse("create_post"),
            json.dumps({"contentche": "oops"}),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)

    def test_create_post_invalid_content_length(self):
        long_content = "a" * 1001  

        response = self.client.post(
            reverse("create_post"),
            json.dumps({"content": long_content}),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)


    def test_edit_post_missing_content(self):
        post = Post.objects.create(user=self.user1, content="expresso polar")

        response = self.client.put(
            reverse("update_post", kwargs={"post_id": post.id}),
            json.dumps({"action": "edit"}), 
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)


    def test_edit_post_invalid_content_length(self):
        post = Post.objects.create(user=self.user1, content="hi")

        response = self.client.put(
            reverse("update_post", kwargs={"post_id": post.id}),
            json.dumps({"action": "edit", "content": "a" * 1001}),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)


    def test_delete_post_unauthorized_returns_403(self):
        post = Post.objects.create(user=self.user2, content="not mine")

        response = self.client.delete(
            reverse("update_post", kwargs={"post_id": post.id}),
            json.dumps({"action": "delete"}),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Post.objects.filter(id=post.id).exists())

    def test_posts_view_unauthenticated_liked_posts_none(self):
        self.client.logout()
        response = self.client.get(reverse("posts", kwargs={"filter": "all"}))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        for post in data["posts"]:
            self.assertIn("liked", post)
            self.assertFalse(post["liked"])


    def test_get_more_posts_unauthenticated_liked_posts_none(self):
        self.client.logout()
        response = self.client.get(reverse("posts", kwargs={"filter": "all"}))
        last = response.json()["posts"][-1]
        
        response2 = self.client.get(
            reverse("get_more_posts", kwargs={"filter": "all"}),
            {"timestamp": last["timestamp"], "post_id": last["id"]}
        )

        self.assertEqual(response2.status_code, 200)
        for post in response2.json()["posts"]:
            self.assertFalse(post["liked"])


    def test_posts_profile_filter_working(self):
        for i in range(5):
            Post.objects.create(user=self.user2, content=f"{i}")
        
        response = self.client.get(
            reverse("posts", kwargs={"filter": "profile"}),
            {"user_id": self.user2.id}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(len(data["posts"]) > 0)


    def test_update_post_not_found(self):
        response = self.client.put(
            reverse("update_post", kwargs={"post_id": 99999}),
            json.dumps({"action": "edit", "content": "whatever"}),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Post does not exist", response.json()["error"])


    def test_update_post_missing_action_keyerror_valueerror(self):
        post = Post.objects.create(user=self.user1, content="oi")
        
        response = self.client.put(
            reverse("update_post", kwargs={"post_id": post.id}),
            "{'action': 'edit'}",  
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)


    def test_update_post_invalid_action(self):
        post = Post.objects.create(user=self.user1, content="oi")
        
        response = self.client.put(
            reverse("update_post", kwargs={"post_id": post.id}),
            json.dumps({"action": "dança_da_pizzinha"}),
            content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid action", response.json()["error"])


    def test_get_more_posts_error_from_get_posts(self):
        response = self.client.get(
            reverse("get_more_posts", kwargs={"filter": "boring"}),
            {"timestamp": "2025-01-01T00:00:00Z", "post_id": "1"}
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn("error", response.json())