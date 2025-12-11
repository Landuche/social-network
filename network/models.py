from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.core.validators import MinLengthValidator, EmailValidator, RegexValidator
from django.contrib.auth.models import AbstractUser
from django.dispatch import receiver
from django.db import models, transaction
from django.db.models import F, Index
from django.db.models.functions import Lower
from django.db.models.signals import pre_save
from django.templatetags.static import static
from versatileimagefield.fields import VersatileImageField

import os, uuid


def profile_picture_upload(instance, filename):
    """
    Generate a unique file path for a user profile picture.

    - instance: the User instance
    - filename: original uploaded filename
    Returns: path
    """
    ext = filename.split(".")[-1]
    file_name = f"{uuid.uuid4()}.{ext}"
    return os.path.join("profile_pics", str(instance.folder_uuid), file_name)


class User(AbstractUser):
    PROFILE_THUMBNAIL_SIZE = "100x100"
    username = models.CharField(
        max_length=150,
        unique=True,
        blank=False,
        db_index=True,
        validators=[
            MinLengthValidator(3, message="Username must be at least 3 characters."),
            RegexValidator(
                regex=r"^[\w.@+-]+$",
                message="Username can only contain letters, numbers, undescores, or dots.",
            ),
        ],
    )
    email = models.EmailField(
        unique=True,
        db_index=True,
        validators=[EmailValidator(message="Invalid email.")],
    )
    folder_uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    followers = models.ManyToManyField(
        "self", symmetrical=False, related_name="following", blank=True
    )
    profile_picture = VersatileImageField(
        upload_to=profile_picture_upload, blank=True, null=True
    )
    post_count = models.PositiveIntegerField(default=0, editable=False)
    followers_count = models.PositiveIntegerField(default=0, editable=False)
    following_count = models.PositiveIntegerField(default=0, editable=False)

    def toggle_follow(self, target_user):
        """
        Toggle follow status for the target_user.
        Handles both the ManyToMany relationship and the counter fields atomically.

        Returns:
            bool: True if now following, False if now unfollowed.
        """
        if self == target_user:
            return False

        follow = target_user.followers.filter(id=self.id).exists()

        with transaction.atomic():
            if follow:
                # Unfollow
                target_user.followers.remove(self)
                self.__class__.objects.filter(id=self.id).update(
                    following_count=F("following_count") - 1
                )
                self.__class__.objects.filter(id=target_user.id).update(
                    followers_count=F("followers_count") - 1
                )
                return False
            else:
                # Follow
                target_user.followers.add(self)
                self.__class__.objects.filter(id=self.id).update(
                    following_count=F("following_count") + 1
                )
                self.__class__.objects.filter(id=target_user.id).update(
                    followers_count=F("followers_count") + 1
                )
                return True

    @property
    def profile_picture_url(self):
        return self.get_profile_picture_url()

    @property
    def profile_thumbnail_url(self):
        return self.get_profile_picture_url(thumbnail=True)

    def get_profile_picture_url(self, thumbnail=False, size=PROFILE_THUMBNAIL_SIZE):
        """
        Handle the profile picture or thumbnail URL.
        Checks storage existence to avoid broken links.

        - thumbnail: if True, return the thumbnail URL
        - size: size string for thumbnail
        """
        if self.profile_picture and default_storage.exists(self.profile_picture.name):
            if thumbnail and default_storage.exists(
                self.profile_picture.thumbnail[size].name
            ):
                return self.profile_picture.thumbnail[size].url
            return self.profile_picture.url
        return ""

    def clean(self):
        """
        Custom validation for:
        - Case-insensitive uniqueness for username and email
        - Profile picture
        """
        super().clean()

        if self.profile_picture and default_storage.exists(self.profile_picture.name):
            from .utils import validate_image

            valid, message = validate_image(self.profile_picture)
            if not valid:
                raise ValidationError({"profile_picture": message})

        # Just to trown a user message
        if (
            User.objects.exclude(pk=self.pk)
            .filter(username__iexact=self.username)
            .exists()
        ):
            raise ValidationError({"username": "Username already in use."})
        if User.objects.exclude(pk=self.pk).filter(email__iexact=self.email).exists():
            raise ValidationError({"email": "Email already in use."})

    class Meta(AbstractUser.Meta):
        """
        Enforces case-insensitive uniqueness for username and email on Unix-based PostgreSQL servers.
        """

        constraints = [
            models.UniqueConstraint(
                Lower("username"),
                name="user_username_ci_unique",
            ),
            models.UniqueConstraint(
                Lower("email"),
                name="user_email_ci_unique",
            ),
        ]
        indexes = [
            Index(Lower("username"), name="user_username_lower_idx"),
            Index(Lower("email"), name="user_email_lower_idx"),
        ]


@receiver(pre_save, sender=User)
def delete_previous_picture(sender, instance, **kwargs):
    """
    Signal to delete the previous profile picture from storage
    when the user uploads a new one, prevent orphan files.
    """
    try:
        old_instance = User.objects.get(pk=instance.pk)
    except User.DoesNotExist:
        return

    old_picture = old_instance.profile_picture
    new_picture = instance.profile_picture

    if old_picture and old_picture != new_picture:
        try:
            old_picture.delete_all_created_images()
            old_picture.delete(save=False)
        except PermissionError:
            pass


class Post(models.Model):
    user = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="posts", db_index=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    content = models.TextField(max_length=250)
    likes = models.ManyToManyField("User", related_name="liked_posts", blank=True)
    like_count = models.PositiveIntegerField(default=0, editable=False)
    comment_count = models.PositiveIntegerField(default=0, editable=False)

    def save_post(self):
        user = self.user
        with transaction.atomic():
            self.save()
            user.__class__.objects.filter(id=user.id).update(
                post_count=F("post_count") + 1
            )

    def delete_post(self):
        user = self.user
        with transaction.atomic():
            self.delete()
            user.__class__.objects.filter(id=user.id).update(
                post_count=F("post_count") - 1
            )

    def like_post(self, user):
        """
        Toggle like status for the post
        Handle atomic transactions

        Returns:
            bool: True if the post is liked, False if the post id desliked
        """
        with transaction.atomic():
            if self.likes.filter(id=user.id).exists():
                # Deslike
                self.likes.remove(user)
                self.__class__.objects.filter(id=self.id).update(
                    like_count=F("like_count") - 1
                )
                liked = False
            else:
                # Like
                self.likes.add(user)
                self.__class__.objects.filter(id=self.id).update(
                    like_count=F("like_count") + 1
                )
                liked = True

            self.refresh_from_db()

            return liked

    def serialize(self, user=None):
        return {
            "id": self.id,
            "user": self.user.username,
            "profile_picture": self.user.profile_thumbnail_url,
            "user_id": self.user.id,
            "user_is_author": (
                user.pk == self.user_id if user and user.is_authenticated else False
            ),
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "like_count": self.like_count,
            "comment_count": self.comment_count,
            "liked": bool(getattr(self, "_liked_by_user", [])),
        }

    class Meta:
        ordering = ["-timestamp", "-id"]
        indexes = [models.Index(fields=["-timestamp", "-id"], name="post_cursor_idx")]


class Comment(models.Model):
    user = models.ForeignKey(
        "User", on_delete=models.CASCADE, related_name="comments", db_index=True
    )
    post = models.ForeignKey(
        "Post", on_delete=models.CASCADE, related_name="comments", db_index=True
    )
    content = models.TextField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    def save_comment(self):
        with transaction.atomic():
            self.save()
            self.post.__class__.objects.filter(id=self.post.id).update(
                comment_count=F("comment_count") + 1
            )
            self.post.refresh_from_db(fields=["comment_count"])

    def delete_comment(self):
        with transaction.atomic():
            post = self.post
            self.delete()
            post.__class__.objects.filter(id=post.id).update(
                comment_count=F("comment_count") - 1
            )
            post.refresh_from_db(fields=["comment_count"])

    def serialize(self, user=None):
        return {
            "id": self.id,
            "user_id": self.user.id,
            "user": self.user.username,
            "user_is_author": user.is_authenticated and user == self.user,
            "profile_picture": self.user.profile_thumbnail_url,
            "content": self.content,
            "timestamp": self.timestamp,
        }

    class Meta:
        ordering = ["timestamp", "id"]
