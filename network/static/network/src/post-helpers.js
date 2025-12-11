/**
 * post-helpers.js
 * Helper functions for post-related DOM manipulation and interactions.
 * - Get post data from DOM elements
 * - Validate and fill post content
 * - Handle like button styling
 * - Manage edit mode
 * - Build URLs for fetching posts
 * - Bind new post form
 */

import { ACTIONS, FILTERS, MESSAGES } from './constants.js';
import { State } from './state.js';
import { DOM, DOMUtils } from './dom.js';
import { UI } from './ui.js';
import { Animations } from './animations.js';
import { Post } from './post.js';
import { ProfileUtils } from './profile.js';
import { Styles } from './constants.js';
import {
    checkArgs,
    formatTimestamp,
    scrollTop
} from './utils.js';


/**
 * Retrieve specified data from the closest post or comment element.
 * - Finds wrapper if requested
 * - Returns requested elements/data 
 * @param {HTMLElement} el - Element inside the post
 * @param {Object} options - Which data to retrieve
 * @returns {Object} - Object containing requested data
 */
export const getPostData = (
    el,
    { wrapper = false, postId = false, userId = false, commentUserId = false,
        postCard = false, postBody = false, postContent = false, postDate = false,
        postEditContainer = false, postComments = false, commentInput = false,
        commentList = false, commentCount = false, commentWrapper = false, commentId = false,
        commentText = false, commentHeader = false, commentEditContainer = false, commentBody = false } = {}
) => {
    const data = {};
    const needsWrapper = wrapper || postId || userId || postCard || postBody || postContent || postDate || postEditContainer || postComments || commentInput || commentList || commentCount;

    let wrapperEl;
    if (needsWrapper) {
        wrapperEl = el.closest('[data-post-id]');
        if (!wrapperEl) {
            console.error('Invalid post wrapper. Element:', el);
            return null;
        }
    }

    const needsCommentWrapper = commentText || commentHeader || commentEditContainer || commentBody;

    let commentWrapperEl;
    if (needsCommentWrapper) {
        commentWrapperEl = el.closest('.comment-wrapper');
        if (!commentWrapperEl) {
            console.error('Invalid comment. Element:', el);
            return null;
        }
    }

    if (wrapper) data.postWrapperEl = wrapperEl;
    if (postId) data.postId = wrapperEl.dataset.postId;
    if (userId) data.userId = wrapperEl.dataset.userId;
    if (postCard) data.postCardEl = wrapperEl.querySelector('.post-card');
    if (postBody) data.postBodyEl = wrapperEl.querySelector('.post-body');
    if (postContent) data.postContentEl = wrapperEl.querySelector('.post-content');
    if (postDate) data.postDateEl = wrapperEl.querySelector('.post-date');
    if (postEditContainer) data.postEditContainerEl = wrapperEl.querySelector('.post-edit-container');
    if (postComments) data.postCommentsEl = wrapperEl.querySelector('.post-comments');
    if (commentInput) data.commentInputEl = wrapperEl.querySelector('#comment-input');
    if (commentList) data.commentListEl = wrapperEl.querySelector('.comment-list');
    if (commentCount) data.commentCountEl = wrapperEl.querySelector('.comment-count');
    if (commentUserId) data.commentUserId = el.closest('[data-comment-user-id]').dataset.commentUserId;
    if (commentId) data.commentId = el.closest('[data-comment-id]').dataset.commentId;
    if (commentWrapper) data.commentWrapperEl = el.closest('.comment-wrapper');
    if (commentText) data.commentTextEl = commentWrapperEl.querySelector('.comment-text');
    if (commentHeader) data.commentHeaderEl = commentWrapperEl.querySelector('.comment-header');
    if (commentEditContainer) data.commentEditContainerEl = commentWrapperEl.querySelector('.comment-edit');
    if (commentBody) data.commentBodyEl = commentWrapperEl.querySelector('.comment-body');

    return data;
};

/**
 * Update like button style based on liked state.
 * - Uses Font Awesome classes and color
 * @param {HTMLElement} el - Like button element
 * @param {boolean} liked - True if post is liked
 */
const setLikeBtnStyle = (el, liked, loading = false) => {
    if (!checkArgs({ el, liked }, 'PostHelpers.setLikeBtnStyle')) return;

    const style = liked ? Styles.buttons.LIKED : Styles.buttons.UNLIKED;

    el.className = style.className;
    el.style.color = liked ? style.color : '';
    if (loading) el.classList.add('disabled-link');
};

/**
 * Validate content.
 * - Must not be empty
 * - Must not exceed max_length
 * - Optionally checks if content changed from original
 * @param {string} content - Content to validate
 * @param {string} [originalContent=null] - Optional original content to compare
 * @returns {{ valid: boolean, message: string|null }} - Validation result and message
 */
export const validateContent = (content, { originalContent = null, maxLength = 250 } = {}) => {
    if (typeof content !== 'string') {
        return { valid: false, message: MESSAGES.post.errors.ui.INVALID_CONTENT };
    }

    if (originalContent && originalContent == content) {
        return { valid: false, message: MESSAGES.info.NO_CHANGES };
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
        return { valid: false, message: MESSAGES.post.errors.ui.EMPTY };
    }
    if (trimmedContent.length > maxLength) {
        const message = MESSAGES.post.errors.ui.EXCEEDS_LIMIT.replace('{max}', maxLength);
        return { valid: false, message };
    }
    return { valid: true, message: null };
};

/**
 * Fill a post element with data.
 * - Sets user name, content, date, and like count
 * @param {Object} postData - Post data
 * @param {HTMLElement} postUserEl
 * @param {HTMLElement} postContentEl
 * @param {HTMLElement} postDateEl
 * @param {HTMLElement} likeCountEl
 * @param {HTMLElement} postProfilePictureEl
 */
const fillPostContent = (postData, postUserEl, postContentEl, postDateEl, likeCountEl, postProfilePictureEl) => {
    if (!checkArgs({
        postData, postUserEl, postContentEl, postDateEl, likeCountEl, postProfilePictureEl
    }, 'PostHelpers.fillPostContent')) return;

    const formattedDate = formatTimestamp(postData.timestamp);

    postUserEl.textContent = postData.user;
    postContentEl.textContent = postData.content;
    postDateEl.textContent = formattedDate;
    likeCountEl.textContent = postData.like_count;
    postProfilePictureEl.src = postData.profile_picture ? postData.profile_picture : window.getDefaultProfilePicture();
};

/**
 * Exit edit mode and restore/update post content.
 * - Removes edit layout
 * - Restores original content or updates with new content
 * - Handles animations and messages
 * - Returns the post content element for further use (e.g., showing messages)
 * @param {HTMLElement} el - Element inside the post
 * @param {string|boolean} [content=false] - Optional new content
 * @returns {HTMLElement|undefined} - The updated post content element, if needed
 */
const cancelEditMode = async (el, content = null) => {
    const { postEditContainerEl, postCardEl, postBodyEl, postDateEl } = getPostData(el, { postEditContainer: true, postCard: true, postBody: true, postDate: true });
    const textareaEl = postEditContainerEl.querySelector('.post-edit-textarea');

    try {
        if (!postEditContainerEl || !textareaEl) throw new Error(MESSAGES.post.errors.dev.INVALID_DATA);

        DOMUtils.removeElMessage(textareaEl);

        await Animations.play(Animations.Names.fadeOutShrink, postEditContainerEl);
        postEditContainerEl.remove();

        const postContentEl = UI.createEl({ elType: 'h6', className: 'post-content' });

        if (content !== null) {
            postContentEl.textContent = content;
        } else {
            const originalContent = postCardEl.dataset.originalContent;
            postContentEl.textContent = originalContent;
        }

        postBodyEl.insertBefore(postContentEl, postDateEl);
        await Animations.play(Animations.Names.fadeInExpand, postContentEl);

        postCardEl.classList.remove('editing');

        if (content) return postContentEl;
    } catch (error) {
        console.error('PostHelpers.cancelEditMode Error: ', error);
        DOMUtils.addElMessage(textareaEl, MESSAGES.ERROR);
    }
};

/**
 * Build the URL for fetching posts.
 * - Uses current filter
 * - Adds user_id for profile view
 * @returns {string} URL
 */
const buildFetchPostsUrl = () => {
    let url = `/posts/${State.currentFilter}`;

    if (State.currentFilter === FILTERS.PROFILE) {
        url += `?user_id=${State.viewProfileUserId}`;
    }

    return url;
};

/**
 * Build the URL for fetching extra posts.
 * - Uses current filter
 * - Adds user_id for profile view
 * - Adds cursorId and cursorTimestamp for post ordering
 * @returns {string} URL
 */
const buildMorePostsUrl = (cursorId, cursorTimestamp) => {
    let url = `/posts/${State.currentFilter}/more?post_id=${cursorId}`;

    if (State.currentFilter === FILTERS.PROFILE) {
        url += `&user_id=${State.viewProfileUserId}`;
    }

    url += `&timestamp=${encodeURIComponent(cursorTimestamp)}`;

    return url;
};

/**
 * Enter edit mode for a post.
 * - Replaces post content with textarea and buttons
 * - Plays animations
 * - Prevents duplicate edits on the same post
 * - Saves original content on dataset
 * @param {HTMLElement} editBtnEl - Edit button of the post
 */
const enterEditMode = async (editBtnEl) => {
    if (State.dropdownLock) return;

    const { postId, postCardEl, postBodyEl, postDateEl, postContentEl } = getPostData(editBtnEl, { postId: true, postCard: true, postBody: true, postDate: true, postContent: true });

    try {
        if (!postId || !postCardEl) {
            DOMUtils.addElMessage(postContentEl, MESSAGES.ERROR);
            console.error(MESSAGES.post.errors.dev.INVALID_DATA);
            return;
        }

        if (postCardEl.classList.contains('editing')) return;
        postCardEl.classList.add('editing');

        const originalContent = postContentEl.textContent;

        postCardEl.dataset.originalContent = originalContent;

        DOMUtils.removeElMessage(postBodyEl);

        const { textareaEl, postEditContainerEl } = UI.createPostEditLayout();

        textareaEl.value = originalContent;

        await Animations.play(Animations.Names.fadeOutShrink, postContentEl);
        postContentEl.remove();

        postBodyEl.insertBefore(postEditContainerEl, postDateEl);
        await Animations.play(Animations.Names.fadeInExpand, postEditContainerEl);
    } catch (error) {
        console.error('PostHelpers.enterEditMode Error: ', error);
        DOMUtils.addElMessage(postContentEl, MESSAGES.ERROR);
    }
};

/**
 * Handle click on a username.
 * - Loads profile if not already viewing
 * - Scrolls to top
 * - No action if already viewing the same profile
 * @param {HTMLElement} usernameEl
 */
const handleUsernameClick = async (usernameEl) => {
    const key = usernameEl.dataset.action === ACTIONS.POST.USER_PROFILE
        ? 'userId'
        : 'commentUserId';

    const { [key]: userId } = getPostData(usernameEl, { [key]: true });

    if (!userId) {
        console.error(MESSAGES.profile.errors.INVALID_ID);
        DOMUtils.displayMainMessage(MESSAGES.profile.errors.ERROR_LOADING_PROFILE);
    }

    if (userId == State.viewProfileUserId) return;

    ProfileUtils.loadProfile(userId);
};

/**
 * Attach event listener to new post form.
 * - Prevents multiple listener attachment
 * - Calls App.Post.createPost on submit
 */
const bindNewPostForm = () => {
    if (!DOM.newPostForm.dataset.listenerAttached) {
        DOM.newPostForm.addEventListener('submit', event => {
            event.preventDefault();

            Post.createPost();
        });
        DOM.newPostForm.dataset.listenerAttached = 'true';
    }
};

/**
 * Create document fragment containing posts and append to feed.
 * - Uses createPostElement for each post
 * @param {Object} data - API response containing posts
 */
const createPostsFragment = (data) => {
    const fragment = document.createDocumentFragment();

    data.posts.forEach(postData => {
        fragment.appendChild(createPostElement(postData));
    })

    DOM.postsFeed.appendChild(fragment);
};

/**
 * Create a fully populated post element ready for insertion into the DOM.
 * - Adds post wrapper, header, user, content, date, footer, and like button
 * - Sets dataset attributes for postId and userId
 * - Adds dropdown if user is author
 * @param {Object} postData - Data for the post
 * @returns {HTMLElement} The complete post element
 */
const createPostElement = (postData) => {
    const { postWrapperEl, postHeaderEl, postUserEl, postContentEl,
        postDateEl, likeCountEl, likeBtnEl, postProfilePictureEl, commentCountEl } = UI.createPostLayout();

    postWrapperEl.dataset.postId = postData.id;
    postWrapperEl.dataset.userId = postData.user_id;
    postWrapperEl.dataset.timestamp = postData.timestamp;
    postWrapperEl.dataset.liked = postData.liked ? 'true' : '';

    fillPostContent(postData, postUserEl, postContentEl, postDateEl, likeCountEl, postProfilePictureEl);

    if (postData.user_is_author) {
        const dropdownWrapperEl = UI.createDropdown();
        postHeaderEl.appendChild(dropdownWrapperEl);
    }
    setLikeBtnStyle(likeBtnEl, postData.liked);
    commentCountEl.textContent = postData.comment_count;

    return postWrapperEl;
};

export const clearPostsFeed = () => {
    const posts = DOM.postsFeed.querySelectorAll('.post-wrapper');
    posts.forEach(post => {
        post.remove();
    })
}

export const PostHelpers = {
    getPostData,
    setLikeBtnStyle,
    validateContent,
    fillPostContent,
    cancelEditMode,
    buildFetchPostsUrl,
    enterEditMode,
    handleUsernameClick,
    bindNewPostForm,
    createPostsFragment,
    createPostElement,
    buildMorePostsUrl
};