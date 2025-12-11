/**
 * comment.js
 * Handles all comment-related client-side functionality.
 * - Create, render, edit, and delete comments dynamically
 * - Manages comment count updates and comment list visibility
 * - Integrates with App.API for CRUD operations
 * - Uses App.DOMUtils, App.Animations, and App.UI for UI rendering
 */

import { MESSAGES } from './constants.js';
import { State } from './state.js';
import { DOM, DOMUtils } from './dom.js';
import { UI } from './ui.js';
import { Animations } from './animations.js';
import { API } from './api.js';
import {
    getPostData,
    validateContent
} from './post-helpers.js';
import {
    checkArgs,
    checkUserAuth,
    formatTimestamp,
    awaitFrame,
    clearElement
} from './utils.js';

/**
 * Builds and returns a DOM element representing a comment.
 * - Dynamically creates dropdown controls if the user is the author
 * - Populates fields 
 * - Add metadata
 * @param {Object} comment - Comment data returned from the backend
 * @returns {HTMLElement|null} Comment wrapper element, or null if invalid
 */
function createCommentElement(comment) {
    if (!checkArgs({ comment }, 'createCommentElement')) return;

    const { commentWrapperEl, commentAvatarEl, commentAuthorEl, commentTextEl, commentTimestampEl } = UI.createCommentLayout();

    if (comment.user_is_author) {
        const dropdownWrapperEl = UI.createDropdown('COMMENT');
        commentWrapperEl.appendChild(dropdownWrapperEl);
    }

    const formattedDate = formatTimestamp(comment.timestamp);

    commentAvatarEl.src = comment.profile_picture ? comment.profile_picture : window.getDefaultProfilePicture();
    commentTextEl.textContent = comment.content;
    commentAuthorEl.textContent = comment.user;
    commentTimestampEl.textContent = formattedDate;
    commentWrapperEl.dataset.commentUserId = comment.user_id;
    commentWrapperEl.dataset.commentId = comment.id;

    return commentWrapperEl;
};

/**
 * Delete a comment by ID.
 * - Calls App.API.deleteComment and animates removal
 * - Updates the comment count
 * @param {number} commentId - Comment identifier
 * @param {HTMLElement} commentWrapperEl - Wrapper element for the comment
 */
async function deleteComment(commentId, commentWrapperEl) {
    if (!checkArgs({ commentId, commentWrapperEl }, 'deleteComment')) return;

    const { commentCountEl } = getPostData(commentWrapperEl, { commentCount: true })
    const spinner = DOMUtils.addSpinner(commentWrapperEl);
    try {
        const { commentCount } = await API.deleteComment(commentId);
        await Animations.play(Animations.Names.fadeOutCollapse, spinner);
        DOMUtils.removeSpinner(spinner);
        commentWrapperEl.remove();
        commentCountEl.textContent = commentCount;
    } catch (error) {
        console.error(error);
        if (commentWrapperEl) DOMUtils.addElMessage(commentWrapperEl, MESSAGES.ERROR);
        DOMUtils.removeSpinner(spinner);
    }
};

/**
 * Create a new comment for a given post.
 * - Validates user authentication and content
 * - Sends request via App.API.createComment
 * - Updates the comment count and animates the new comment insertion
 * 
 * @param {HTMLElement} sendBtnEl - The button that triggered the action
 */
const createComment = async (sendBtnEl) => {
    if (sendBtnEl.disabled) return;
    if (!checkUserAuth()) return;

    const { postId, commentInputEl, commentListEl, commentCountEl } = getPostData(sendBtnEl, { wrapper: true, postId: true, commentInput: true, commentList: true, commentCount: true });

    const spinner = DOMUtils.addSpinner(sendBtnEl);
    try {
        if (!postId || !commentInputEl) throw new Error(MESSAGES.post.errors.dev.INVALID_DATA);

        const content = commentInputEl.value.trim();
        const validation = validateContent(content, { maxLength: 100 });
        if (!validation.valid) {
            DOMUtils.addElMessage(commentListEl, validation.message, { color: 'info' });
            return;
        }

        const { comment, commentCount } = await API.createComment(postId, content);

        // Create and animate the new comment element
        const commentEl = createCommentElement(comment);
        commentEl.style.height = '0';
        commentEl.style.overflow = 'hidden';
        commentListEl.prepend(commentEl);

        commentCountEl.textContent = commentCount;

        await awaitFrame();
        await Animations.expand(commentEl);

        commentEl.style.overflow = 'visible';
        commentInputEl.value = '';
    } catch (error) {
        DOMUtils.addElMessage(commentListEl, MESSAGES.ERROR, { color: 'danger' });
        console.error(error);
    } finally {
        DOMUtils.removeSpinner(spinner);
    }
};

/**
 * Toggle the visibility of a post’s comment section.
 * - Toggle animations
 * - Fetches comments via App.API.fetchComments when expanding
 * - Clears the comment list when collapsing
 * 
 * @param {HTMLElement} commentIconEl - The comment icon element
 */
const toggleComments = async (commentIconEl) => {
    if (!checkArgs({ commentIconEl }, 'toggleComments')) return;

    const { postId, postCommentsEl, commentListEl, commentCountEl } = getPostData(commentIconEl, { postId: true, postComments: true, commentList: true, commentCount: true });

    const isHidden = postCommentsEl.classList.contains('d-none');

    if (isHidden) {
        const spinner = DOMUtils.addSpinner(commentIconEl);
        try {
            if (!postId || !postCommentsEl) throw new Error(MESSAGES.post.errors.dev.INVALID_DATA);
            const { comments } = await API.fetchComments(postId);

            commentCountEl.textContent = comments.length;

            const fragment = document.createDocumentFragment();
            comments.forEach(comment => {
                const commentWrapperEl = createCommentElement(comment);
                commentWrapperEl.style.overflow = 'visible';
                fragment.append(commentWrapperEl);
            })
            commentListEl.append(fragment);
        } catch (error) {
            DOMUtils.addElMessage(commentListEl, MESSAGES.ERROR, { color: 'danger' });
            console.error(error);
        } finally {
            DOMUtils.removeSpinner(spinner);
            postCommentsEl.style.overflow = 'hidden';
            postCommentsEl.classList.remove('d-none');
            await Animations.expand(postCommentsEl);
            postCommentsEl.style.overflow = 'visible';
        }
    } else {
        // Collapse and clear comment list
        postCommentsEl.style.overflow = 'hidden';
        await Animations.collapse(postCommentsEl);
        postCommentsEl.classList.add('d-none');
        clearElement(commentListEl);
    }
};

/**
 * Show a confirmation modal before deleting a comment.
 * - Creates modal layout with confirm and cancel buttons
 * - Calls deleteComment() on confirmation
 * 
 * @param {HTMLElement} deleteBtnEl - Delete button clicked by the user
 */
const showDeleteCommentModal = (deleteBtnEl) => {
    if (document.querySelector('.modal-overlay')) return;
    if (State.dropdownLock) return;
    if (!checkUserAuth()) return;

    // Get comment data
    const { commentWrapperEl, commentId } = getPostData(deleteBtnEl, { commentWrapper: true, commentId: true });

    // Create modal
    const { modalOverlayEl, modalFooterEl, modalTitleEl, saveBtnEl, modalBodyEl } = UI.createBaseModal();

    modalTitleEl.textContent = 'Confirm Action';

    const modalMessageEl = UI.createEl({ elType: 'p', className: 'modal-message', textContent: MESSAGES.dom.modal.info.CONFIRM_DELETE });
    modalBodyEl.append(modalMessageEl);

    // Attach event listener on confirm button
    saveBtnEl.textContent = 'Confirm';
    saveBtnEl.addEventListener('click', () => {
        DOMUtils.closeModal();
        deleteComment(commentId, commentWrapperEl);
    }, { once: true });

    DOM.modalContainer.append(modalOverlayEl);
};

/**
 * Enter edit mode for a comment.
 * - Replaces text span with editable textarea
 * - Animates transition in/out
 * - Stores original content on dataset
 * - Add class .editing
 * @param {HTMLElement} editBtnEl - Edit button clicked by the user
 */
const enterEditMode = async (editBtnEl) => {
    if (State.dropdownLock) return;

    const { commentTextEl, commentHeaderEl, commentWrapperEl } = getPostData(editBtnEl, { commentText: true, commentHeader: true, commentWrapper: true });

    if (commentHeaderEl.classList.contains('editing')) return;
    try {
        if (!commentTextEl || !commentHeaderEl || !commentWrapperEl) {
            if (commentWrapperEl) DOMUtils.addElMessage(commentWrapperEl, MESSAGES.ERROR, { color: 'danger' });
            console.error(MESSAGES.ERROR);
            return;
        }
        commentHeaderEl.classList.add('editing');

        const originalContent = commentTextEl.textContent;
        commentHeaderEl.dataset.originalContent = originalContent;

        const { wrapperEl } = UI.createCommentEditLayout(originalContent);

        await Animations.play(Animations.Names.fadeOutShrink, commentTextEl);
        commentTextEl.remove();

        commentHeaderEl.append(wrapperEl);
        await Animations.play(Animations.Names.fadeInExpand, wrapperEl);
    } catch (error) {
        DOMUtils.addElMessage(commentWrapperEl, MESSAGES.ERROR, { color: 'danger' });
        console.error(error);
    }
};

/**
 * Cancel edit mode for a comment.
 * - Restores original or updated text
 * - Animates transition in/out
 * 
 * @param {HTMLElement} cancelBtnEl - Cancel button clicked by the user
 * @param {string|null} [content=null] - Optional new text content to display
 */
const cancelEditMode = async (cancelBtnEl, content = null) => {
    const { commentEditContainerEl, commentHeaderEl, commentWrapperEl } = getPostData(cancelBtnEl, { commentEditContainer: true, commentHeader: true, commentWrapper: true });
    try {
        if (!commentEditContainerEl) throw new Error(MESSAGES.ERROR);

        await Animations.play(Animations.Names.fadeOutShrink, commentEditContainerEl);
        commentEditContainerEl.remove();

        const commentTextEl = UI.createEl({
            elType: 'span',
            className: 'comment-text'
        });

        if (content !== null) {
            commentTextEl.textContent = content;
        } else {
            const originalContent = commentHeaderEl.dataset.originalContent;
            commentTextEl.textContent = originalContent;
        }

        commentHeaderEl.append(commentTextEl);
        await Animations.play(Animations.Names.fadeInExpand, commentTextEl);

        commentHeaderEl.classList.remove('editing');
    } catch (error) {
        DOMUtils.addElMessage(commentWrapperEl, MESSAGES.ERROR, { color: 'danger' });
        console.error(error);
    }
};

/**
 * Save edited comment to the backend.
 * - Validates input and prevents duplicate submissions
 * - Updates comment on success and restores view mode
 * 
 * @param {HTMLElement} saveBtnEl - Save button clicked by the user
 */
const saveEditedComment = async (saveBtnEl) => {
    if (!checkUserAuth()) return;
    saveBtnEl.disabled = true;

    const { commentId, commentEditContainerEl, commentHeaderEl, commentWrapperEl, commentBodyEl } = getPostData(saveBtnEl, { commentId: true, commentEditContainer: true, commentHeader: true, commentWrapper: true, commentBody: true });
    const textareaEl = commentEditContainerEl.querySelector('.comment-textarea');

    const spinner = DOMUtils.addSpinner(saveBtnEl);
    try {
        if (!commentId || !textareaEl || !commentWrapperEl) throw new Error(MESSAGES.ERROR);

        const content = textareaEl.value.trim();
        const originalContent = commentHeaderEl.dataset.originalContent;
        const validation = validateContent(content, { originalContent, maxLength: 100 });
        if (!validation.valid) {
            DOMUtils.addElMessage(commentBodyEl, validation.message, { color: 'info', position: 'beforeend' });
            DOMUtils.removeSpinner(spinner);
            return;
        }

        const result = await API.editComment(commentId, content);

        DOMUtils.removeSpinner(spinner);
        await cancelEditMode(saveBtnEl, result.content);
        DOMUtils.addElMessage(commentBodyEl, MESSAGES.post.success.UPDATED, { color: 'success', position: 'beforeend' });
    } catch (error) {
        DOMUtils.addElMessage(commentBodyEl, MESSAGES.ERROR, { color: 'danger', position: 'beforeend' });
        DOMUtils.removeSpinner(spinner);
        console.error(error);
    } finally {
        saveBtnEl.disabled = false;
    }
};

export const Comment = {
    createComment,
    toggleComments,
    showDeleteCommentModal,
    enterEditMode,
    cancelEditMode,
    saveEditedComment,
};