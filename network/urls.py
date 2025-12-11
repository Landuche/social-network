from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from . import comments, posts, profiles, views

urlpatterns = [
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),
    path("post", posts.create_post, name="create_post"),
    path("post/<int:post_id>", posts.update_post, name="update_post"),
    path("post/<int:post_id>/comment", comments.create_comment, name="create_comment"),
    path(
        "post/comment/<int:comment_id>", comments.update_comment, name="update_comment"
    ),
    path("post/<int:post_id>/comments", comments.comments_view, name="comments"),
    path("posts/<str:filter>", posts.posts_view, name="posts"),
    path("profile/<int:id>", profiles.profile_view, name="profile"),
    path("profile/edit", profiles.edit_profile, name="edit_profile"),
    path("follow/<int:id>", profiles.follow_view, name="follow"),
    path("user/<int:user_id>/email", profiles.get_email, name="get_email"),
    path("posts/<str:filter>/more", posts.get_more_posts, name="get_more_posts"),
]

if settings.DEBUG:  # pragma: no cover
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
