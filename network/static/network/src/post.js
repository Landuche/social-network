/**
 * post.js
 * Post-related logic.
 * - Handles post interactions: like, edit, delete, create
 * - Delegates events from posts feed
 * - Handles API calls and updates DOM
 */

import { ACTIONS, FILTERS, MESSAGES } from './constants.js';
import { State } from './state.js';
import { API } from './api.js';
import { DOM, DOMUtils } from './dom.js';
import { PostHelpers, clearPostsFeed } from './post-helpers.js';
import { UI } from './ui.js';
import { Comment } from './comment.js';
import {
    checkArgs,
    checkUserAuth,
    awaitFrame,
} from './utils.js';
import { Animations } from './animations.js';
import { updateNavbar } from './header.js';


/**
 * Delegate click events on the posts feed.
 * - Determine action using dataset
 * - Handles all post and comment related clicks
 */
const delegate = () => {
    const ACTION_HANDLERS = {
        [ACTIONS.POST.LIKE]: handleLikePostClick,
        [ACTIONS.POST.DROPDOWN]: DOMUtils.toggleDropdown,
        [ACTIONS.POST.EDIT]: PostHelpers.enterEditMode,
        [ACTIONS.POST.DELETE]: showDeletePostModal,
        [ACTIONS.POST.USER_PROFILE]: PostHelpers.handleUsernameClick,
        [ACTIONS.POST.COMMENT_USER_PROFILE]: PostHelpers.handleUsernameClick,
        [ACTIONS.POST.CANCEL_EDIT]: PostHelpers.cancelEditMode,
        [ACTIONS.POST.SAVE_EDIT]: saveEditedPost,
        [ACTIONS.POST.COMMENTS]: Comment.toggleComments,
        [ACTIONS.POST.CREATE_COMMENT]: Comment.createComment,

        [ACTIONS.COMMENT.EDIT]: Comment.enterEditMode,
        [ACTIONS.COMMENT.DELETE]: Comment.showDeleteCommentModal,
        [ACTIONS.COMMENT.CANCEL_EDIT]: Comment.cancelEditMode,
        [ACTIONS.COMMENT.SAVE_EDIT]: Comment.saveEditedComment
    };
    DOM.postsFeed.addEventListener('click', (event) => {
        const targetAction = event.target.closest('[data-action]');
        if (!targetAction) return;
        const action = targetAction.dataset.action;
        if (!action) return;

        ACTION_HANDLERS[action](targetAction);
    });
};

/**
 * Show a confirmation modal before deleting a post.
 * - Guarded by App.State.dropdownLock to ensure dropdown is open
 * - Checks authentication and dropdown lock
 * - Retrieves post ID and wrapper element
 * - Calls deletePost if confirmed
 * @param {HTMLElement} deleteBtnEl 
 */
function showDeletePostModal(deleteBtnEl) {
    if (document.querySelector('.modal-overlay')) return;
    if (State.dropdownLock) return;
    if (!checkUserAuth()) return;

    // Get post data
    const { postWrapperEl, postId } = PostHelpers.getPostData(deleteBtnEl, { wrapper: true, postId: true });

    // Create modal
    const { modalOverlayEl, modalTitleEl, modalBodyEl, saveBtnEl } = UI.createBaseModal();

    modalTitleEl.textContent = 'Confirm Action';

    const modalMessageEl = UI.createEl({ elType: 'p', className: 'modal-message' });
    modalMessageEl.textContent = MESSAGES.dom.modal.info.CONFIRM_DELETE;
    modalBodyEl.append(modalMessageEl);

    // Create confirm button and attach event listener
    saveBtnEl.textContent = 'Confirm';
    saveBtnEl.addEventListener('click', () => {
        DOMUtils.closeModal();
        deletePost(postId, postWrapperEl);
    }, { once: true })

    DOM.modalContainer.append(modalOverlayEl);
}

/**
 * Delete a post.
 * - Calls API to delete post
 * - Removes post from DOM
 * - Handles animations
 * - Logs errors and shows a UI message
 * - Updates profile post count and reloads posts if needed
 * @param {number} postId
 * @param {HTMLElement} postWrapperEl
 */
const deletePost = async (postId, postWrapperEl) => {
    if (!checkArgs({ postId, postWrapperEl }, 'Post.deletePost')) return;

    const spinner = DOMUtils.addSpinner(postWrapperEl);
    try {
        await API.deletePost(postId);
        await Animations.play(Animations.Names.fadeOutCollapse, spinner);
        DOMUtils.removeSpinner(spinner);
        postWrapperEl.remove();
        State.postsCount -= 1;
    } catch {
        DOMUtils.removeSpinner(spinner);
        DOMUtils.addElMessage(postWrapperEl, MESSAGES.ERROR);
    }

    if (State.postsCount === 0) {
        loadPosts({ viewProfileUserId: State.currentUserId, filter: State.currentFilter });
    }

    if (State.currentFilter == FILTERS.PROFILE) {
        // Update profile post count 
        const currentCount = Number(DOM.profilePostsCount.textContent);
        DOM.profilePostsCount.textContent = Math.max(0, currentCount - 1);
    }
};

/**
 * Save an edited post.
 * - Validates post content
 * - Sends edit to API
 * - Calls cancelEditMode to restore/update post content
 * - Adds success message on updated content
 * - Disables/enables save button during operation
 * - Logs errors and shows a UI message
 * @param {HTMLElement} saveBtnEl 
 */
const saveEditedPost = async (saveBtnEl) => {
    if (!checkUserAuth()) return;

    const { postId, postEditContainerEl, postCardEl } = PostHelpers.getPostData(saveBtnEl, { postId: true, postEditContainer: true, postCard: true });
    const textareaEl = postEditContainerEl.querySelector('.post-edit-textarea');

    const spinner = DOMUtils.addSpinner(saveBtnEl);
    try {
        if (!postId || !textareaEl) throw new Error(MESSAGES.post.errors.dev.INVALID_DATA);

        // Validate post content
        const content = textareaEl.value.trim();
        const originalContent = postCardEl.dataset.originalContent;
        const validation = PostHelpers.validateContent(content, { originalContent });
        if (!validation.valid) {
            DOMUtils.addElMessage(textareaEl, validation.message, { color: 'info' });
            DOMUtils.removeSpinner(spinner);
            return;
        }

        // Fetch API
        const result = await API.editPost(postId, content);

        // Update UI
        DOMUtils.removeSpinner(spinner);
        const postContentEl = await PostHelpers.cancelEditMode(saveBtnEl, result.content);
        DOMUtils.addElMessage(postContentEl, MESSAGES.post.success.UPDATED, { color: 'success' });
    } catch (error) {
        DOMUtils.removeSpinner(spinner);
        DOMUtils.addElMessage(textareaEl, MESSAGES.post.errors.ui.ERROR_SAVING_POST);
        console.error('Post.saveEditedPost:', error);
    }
};

/**
 * Handle like button click.
 * - Checks authentication
 * - Calls API to toggle like
 * - Updates like count and button style asynchronously
 * - Disables/enables like button during operation
 * - Logs errors and shows a UI message
 * @param {HTMLElement} likeBtnEl
 */
async function handleLikePostClick(likeBtnEl) {
    if (likeBtnEl.disabled) return;
    if (!checkUserAuth()) return;
    likeBtnEl.disabled = true;

    const { postWrapperEl, postId } = PostHelpers.getPostData(likeBtnEl, { wrapper: true, postId: true });
    const likeCountEl = postWrapperEl.querySelector('.like-count');
    const likeCount = +likeCountEl.textContent;
    const isLiked = postWrapperEl.dataset.liked === 'true';

    try {
        if (!postId || !likeCountEl) throw new Error(MESSAGES.post.errors.dev.INVALID_DATA);

        // Optimistic update
        likeCountEl.textContent = isLiked ? likeCount - 1 : likeCount + 1;
        PostHelpers.setLikeBtnStyle(likeBtnEl, !isLiked, true);
        delete postWrapperEl.dataset.liked;

        // Sync with server
        const { like_count, liked } = await API.likePost(postId);
        PostHelpers.setLikeBtnStyle(likeBtnEl, liked);
        postWrapperEl.dataset.liked = liked ? 'true' : '';
        likeCountEl.textContent = like_count;
    } catch (error) {
        console.error('handleLikePostClick:', error);
        DOMUtils.addElMessage(likeCountEl, MESSAGES.post.errors.ui.ERROR_LIKING_POST);
        likeCountEl.textContent = isLiked ? likeCount - 1 : likeCount + 1;
        postWrapperEl.dataset.liked = isLiked ? '' : 'true';
        PostHelpers.setLikeBtnStyle(likeBtnEl, isLiked);
    } finally {
        likeBtnEl.classList.remove('disabled-link');
        likeBtnEl.disabled = false;
    }
};

/**
 * Create a new post.
 * - Validates textarea content
 * - Calls API to create post
 * - Clears input and shows success message
 * - Reloads posts via loadPosts
 * - Logs errors and shows a UI message
 * - `highlightId` triggers animation on the entire posts feed
 * - Reload feed if empty, to remove message
 */
const createPost = async () => {
    if (!checkUserAuth()) return;
    const spinner = DOMUtils.addSpinner(DOM.newPostSubmitBtn);

    try {
        // Validate post content
        const content = DOM.newPostContent.value.trim();
        const validation = PostHelpers.validateContent(content);
        if (!validation.valid) {
            DOMUtils.addElMessage(DOM.newPostContent, validation.message, { color: 'info' });
            DOMUtils.removeSpinner(spinner);
            return;
        }

        // Create post via API
        const { postData } = await API.createPost(content);

        // Update UI
        DOM.newPostContent.value = '';
        DOMUtils.addElMessage(DOM.newPostContent, (MESSAGES.post.success.CREATED), { color: 'success' });
        if (State.postsCount == 0) {
            loadPosts({ highlightId: postData.id, filter: State.currentFilter });
            return;
        }
        State.postsCount += 1;

        const postEl = PostHelpers.createPostElement(postData);
        postEl.style.height = '0';
        postEl.style.overflow = 'hidden';
        DOM.postsFeed.prepend(postEl);

        await awaitFrame();
        await Animations.expand(postEl);

        postEl.style.overflow = 'visible';
    } catch (error) {
        DOMUtils.addElMessage(DOM.newPostContent, MESSAGES.post.errors.ui.ERROR_CREATING_POST);
        console.error(error);
    } finally {
        DOMUtils.removeSpinner(spinner);
    }
};

/**
 * Call fetchPosts to load first batch of posts.
 * - Updates state 
 * - Clears previous posts
 * - Handles highlight animation for new posts
 * @param {Object} options - Optional parameters
 * @param {number|null} [options.viewProfileUserId=null] - User id, if on a profile
 * @param {number|null} [options.highlightId=null] - If set, animates posts feed
 * @param {string|null} [options.filter=null] - Filter to set state
 */
const loadPosts = async ({ viewProfileUserId = null, highlightId = null, filter = null } = {}) => {
    if (State.postsLoading) return;

    // Update state
    viewProfileUserId ? State.viewProfileUserId = viewProfileUserId : State.viewProfileUserId = null;
    if (filter) {
        State.currentFilter = filter;
        updateNavbar();
    }
    State.postsLoading = true;
    State.postsCount = 0;

    // Define fetch url
    let fetchPostsUrl = PostHelpers.buildFetchPostsUrl()

    // Get infinite scroll sentinel
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
        DOMUtils.cleanObserver();
        DOMUtils.toggleSentinelLoading(true, sentinel);
    }

    clearPostsFeed();

    DOMUtils.updateLayout();

    await fetchPosts(fetchPostsUrl, sentinel);

    if (highlightId) await Animations.play(Animations.Names.fadeInExpand, DOM.postsFeed);
};

/**
 * Call fetchPosts to load the next batch of posts for infinite scrolling.
 * - Updates state
 * - Keeps the existing posts in the DOM
 * - Appends new posts using createPostsFragment
 * - Handles empty responses 
 * - Manages sentinel loading indicator and observer state
 * - Ensures smooth infinite scroll behavior
 */
const loadMorePosts = async () => {
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    const lastPostEl = sentinel.previousElementSibling;

    if (!lastPostEl || !sentinel) {
        return;
    }

    DOMUtils.toggleSentinelLoading(true, sentinel);

    const cursorTimestamp = lastPostEl.dataset.timestamp;
    const cursorId = lastPostEl.dataset.postId;

    // Build URL
    let url = PostHelpers.buildMorePostsUrl(cursorId, cursorTimestamp);

    if (State.scrollObserver) State.scrollObserver.unobserve(sentinel);

    await fetchPosts(url, sentinel);
};


/**
 * Use received url to fetch posts.
 *
 * - Handle intersection observer sentinel
 * - Display message if no posts found on database and on error
 * - Update state
 * @param {string} - url to be used on the API call
 * @param {IntersectionObserver} - sentinel
*/
const fetchPosts = async (url, sentinel) => {
    try {
        const data = await API.fetchPosts(url);

        if (!data.posts || data.posts.length === 0) {
            DOMUtils.displayMainMessage(MESSAGES.post.errors.ui.NO_POSTS_FOUND, 'info');
            State.postsLoading = false;
            return;
        }

        // Update state
        State.postsCount += data.posts.length;
        State.hasNextPost = data.hasNext;

        if (sentinel) sentinel.remove();
        PostHelpers.createPostsFragment(data);
        if (sentinel) DOM.postsFeed.append(sentinel);

        if (State.hasNextPost) DOMUtils.initInfiniteScroll();
    } catch (error) {
        DOMUtils.displayMainMessage(MESSAGES.post.errors.ui.ERROR_LOADING_POSTS);
        console.error(error);
    } finally {
        DOMUtils.toggleSentinelLoading(false, sentinel);
    }
}


export const Post = {
    delegate,
    deletePost,
    saveEditedPost,
    createPost,
    loadPosts,
    loadMorePosts,
};