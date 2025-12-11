import json
from django.urls import reverse
from network.models import Comment, Post, User
from base import BaseNetworkTest

class TestComments(BaseNetworkTest):

    def test_create_comment(self):
        url = reverse("create_comment", kwargs={"post_id": self.first_post.id})
        response = self.client.post(
            url,
            json.dumps({"content": "Great post!"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Comment.objects.count(), 1)

    def test_delete_unauthorized(self):
        commenter = self.user1
        intruder = self.user2

        comment = Comment.objects.create(user=commenter, post=self.first_post, content="Hi")

        self.client.force_login(intruder)

        res = self.client.delete(
            reverse("update_comment", kwargs={"comment_id": comment.id}),
            json.dumps({"action": "delete"}), content_type="application/json"
        )

        self.assertEqual(res.status_code, 403)
        self.assertTrue(Comment.objects.filter(id=comment.id).exists())

    def test_get_comments(self):
        url = reverse("comments", kwargs={"post_id": self.first_post.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("comments", response.json())

    def test_create_and_get_comments(self):
        initial_count = self.first_post.comment_count

        # Create comment
        response = self.client.post(
            reverse("create_comment", kwargs={"post_id": self.first_post.id}),
            json.dumps({"content": "post"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)

        # Refresh post from DB to get updated denormalized count
        self.first_post.refresh_from_db()
        self.assertEqual(self.first_post.comment_count, initial_count + 1)

        # Get comments
        response = self.client.get(reverse("comments", kwargs={"post_id": self.first_post.id}))
        self.assertEqual(response.status_code, 200)
        comments = response.json()["comments"]
        self.assertEqual(len(comments), 1)
        self.assertIn("post", comments[0]["content"])

    def test_unauthorized_comment_delete(self):
            # Create a second user (Bob) and a post
            user2 = User.objects.create_user(username="bob2", password="testpass123")
            post = Post.objects.create(user=self.user1, content="Original Post")

            # 1. Alice creates a comment
            comment = Comment.objects.create(user=self.user1, post=post, content="Alice's comment")
            
            # Attempts to delete Alice's comment
            self.client.force_login(user2)  # Login as Bob
            
            delete_payload = json.dumps({"action": "delete"})
            
            response = self.client.delete(
                reverse("update_comment", kwargs={"comment_id": comment.id}),
                delete_payload,
                content_type="application/json"
            )
            
            self.assertEqual(response.status_code, 403) 
            self.assertIn("Unauthorized.", response.json()["error"])
            
            self.assertTrue(Comment.objects.filter(id=comment.id).exists())

    def test_comment_edit_own_comment(self):
        comment = Comment.objects.create(user=self.user1, post=self.first_post, content="Old")
        
        response = self.client.put(
            reverse("update_comment", kwargs={"comment_id": comment.id}),
            json.dumps({"action": "edit", "content": "New content"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        comment.refresh_from_db()
        self.assertEqual(comment.content, "New content")

    def test_comment_delete_own_comment(self):
        post = Post.objects.create(user=self.user1, content="pegue a varinha harry")
        base_count = post.comment_count

        response = self.client.post(
            reverse("create_comment", kwargs={"post_id": post.id}),
            json.dumps({"content": "Comment"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        comment = response.json()["comment"]

        post.refresh_from_db()
        self.assertEqual(post.comment_count, base_count + 1)

        response = self.client.delete(
            reverse("update_comment", kwargs={"comment_id": comment["id"]}),
            json.dumps({"action": "delete"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

        post.refresh_from_db()
        self.assertEqual(post.comment_count, base_count)

    def test_create_comment_post_does_not_exist(self):
        url = reverse("create_comment", kwargs={"post_id": 99999})
        response = self.client.post(
            url,
            json.dumps({"content": "Valid comment"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Post does not exist.")


    def test_create_comment_invalid_content_validation(self):
        url = reverse("create_comment", kwargs={"post_id": self.first_post.id})

        long_content = "a" * 101

        response = self.client.post(
            url,
            json.dumps({"content": long_content}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("100", response.json()["error"])  


    def test_update_comment_not_found(self):
        response = self.client.put(
            reverse("update_comment", kwargs={"comment_id": 99999}),
            json.dumps({"action": "edit", "content": "whatever"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Comment does not exist.")


    def test_update_comment_invalid_action(self):
        comment = Comment.objects.create(user=self.user1, post=self.first_post, content="oi")
        
        response = self.client.put(
            reverse("update_comment", kwargs={"comment_id": comment.id}),
            json.dumps({"action": "whatever"}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid action", response.json()["error"])


    def test_edit_comment_missing_content(self):
        comment = Comment.objects.create(user=self.user1, post=self.first_post, content="oi")
        
        response = self.client.put(
            reverse("update_comment", kwargs={"comment_id": comment.id}),
            json.dumps({"action": "edit"}),  
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("content", response.json()["error"].lower())

    def test_update_comment_malformed_json(self):
        comment = Comment.objects.create(user=self.user1, post=self.first_post, content="oi")

        malformed_json = "{'action': 'edit', 'content': 'oops'"

        response = self.client.put(
            reverse("update_comment", kwargs={"comment_id": comment.id}),
            malformed_json,
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid JSON", response.json()["error"])


    def test_edit_comment_content_too_long(self):
        comment = Comment.objects.create(user=self.user1, post=self.first_post, content="oi")

        long_content = "a" * 101  

        response = self.client.put(
            reverse("update_comment", kwargs={"comment_id": comment.id}),
            json.dumps({"action": "edit", "content": long_content}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("100", response.json()["error"]) 