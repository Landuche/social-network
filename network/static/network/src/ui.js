/**
 * ui.js
 * Centralized UI scaffolding for reusable DOM components.
 * - Provides helper to create base customizable base elements
 * - Provides scaffold layouts
 * - Ensures consistent structure before dynamic data is injected
 */

import { DOMUtils } from './dom.js';
import { Constants } from './constants.js';

/**
 * Creates a new DOM element with optional attributes.
 * @param {string} [elType] - Element type
 * @param {string} [className] - Element classes
 * @param {string} [textContent] - Element text content
 * @param {string} [color] - Element color
 * @param {string} [value] - Element value
 * @param {boolean} [disabled] - Disable element
 * @param {Object} [dataset] - Dataset  
 * @param {Object} [attributes] - Attributes
 * @returns {HTMLElement} The created DOM element
 */
export const createEl = ({ elType = null, className = null, textContent = null, color = null, value = null, disabled = false, dataset = {}, attributes = {} } = {}) => {
    if (!elType) {
        console.error('UI.createEl: Missing element type');
        return null;
    }

    const el = document.createElement(elType);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    if (color) el.style.color = color;
    if (value !== null && value !== undefined) el.value = value;
    if (dataset && typeof dataset === 'object') {
        for (const key in dataset) {
            el.dataset[key] = dataset[key];
        }
    }
    if (attributes && typeof attributes === 'object') {
        for (const [key, val] of Object.entries(attributes)) {
            el.setAttribute(key, val);
        }
    }
    el.disabled = disabled;

    return el;
};

/**
 * Create a loading spinner.
 * @returns {HTMLElement} - Loading spinner element.
 */
export const spinner = (size = '38px') => {
    const spinner = UI.createEl({ elType: 'div', className: 'loading' });
    return spinner;
}

/**
 * Create a generic modal.
 * @returns {HTMLElement} - Modal elements to be filled on the caller function.
 */
export const createBaseModal = () => {
    const modalOverlayEl = createEl({
        elType: 'div',
        className: 'modal-overlay'
    });
    const modalContainerEl = createEl({
        elType: 'div',
        className: 'modal-container modal-container d-flex flex-column align-items-center'
    });
    const modalHeaderEl = createEl({
        elType: 'div',
        className: 'modal-header'
    });
    const modalTitleEl = createEl({
        elType: 'h2',
        className: 'modal-title'
    });
    const modalBodyEl = createEl({
        elType: 'div',
        className: 'modal-body my-2'
    });
    const modalFooterEl = createEl({
        elType: 'div',
        className: 'd-flex justify-content-center g-2',
        attributes: {
            style: 'gap: 12px;'
        }
    });
    const cancelBtnEl = createEl({
        elType: 'button',
        className: 'btn btn-danger cancel-btn',
        textContent: 'Cancel'
    });

    const saveBtnEl = UI.createEl({
        elType: 'button',
        className: 'btn btn-primary save-btn'
    });

    modalHeaderEl.append(modalTitleEl);
    modalFooterEl.append(saveBtnEl, cancelBtnEl);
    modalContainerEl.append(modalHeaderEl, modalBodyEl, modalFooterEl);
    modalOverlayEl.append(modalContainerEl);

    cancelBtnEl.addEventListener('click', () => {
        DOMUtils.closeModal();
    }, { once: true });

    return { modalOverlayEl, modalFooterEl, modalTitleEl, modalBodyEl, saveBtnEl, cancelBtnEl };
};

/**
 * Creates a dropdown menu.
 * @returns {HTMLElement} The dropdown wrapper with button + menu
 */
export const createDropdown = (type = 'POST') => {
    const ACTIONS = Constants.ACTIONS[type.toUpperCase()];
    if (!ACTIONS) {
        console.error('UI.createDropdown: Invalid type:', type);
        return null;
    }

    const dropdownWrapperEl = createEl({
        elType: 'div',
        className: 'dropdown-wrapper'
    });
    const dropdownBtnEl = createEl({
        elType: 'button',
        className: 'dots-btn',
        textContent: '...',
        dataset: { action: Constants.ACTIONS.POST.DROPDOWN }
    });
    const dropdownMenuEl = createEl({
        elType: 'div',
        className: 'dropdown-menu d-none'
    });
    const editBtnEl = createEl({
        elType: 'button',
        className: 'dropdown-item edit',
        textContent: 'Edit',
        dataset: { action: ACTIONS.EDIT }
    });
    const deleteBtnEl = createEl({
        elType: 'button',
        className: 'dropdown-item delete',
        textContent: 'Delete',
        dataset: { action: ACTIONS.DELETE }
    });

    dropdownMenuEl.append(editBtnEl, deleteBtnEl);
    dropdownWrapperEl.append(dropdownBtnEl, dropdownMenuEl)

    return dropdownWrapperEl;
};

/**
 * Creates the base layout for a post, without content filled in.
 * Used as a scaffold for rendering post data.
 * 
 * @returns {HTMLElement} Full post wrapper element
 */
export const createPostLayout = () => {
    const postWrapperEl = createEl({
        elType: 'div',
        className: 'post-wrapper row justify-content-center'
    });

    const responsiveContainer = createEl({
        elType: 'div',
        className: 'col-12 col-md-9 col-lg-7 col-xl-6'
    });

    const postCardEl = createEl({
        elType: 'div',
        className: 'post-card shadow border p-3'
    });

    const postBodyEl = createEl({
        elType: 'div',
        className: 'post-body'
    });
    const postHeaderEl = createEl({
        elType: 'div',
        className: 'post-header d-flex justify-content-between align-items-center'
    });
    const headerDivEl = createEl({
        elType: 'div',
        className: 'd-flex align-items-center'
    });
    const postProfilePictureEl = createEl({
        elType: 'img',
        className: 'post-profile-picture rounded-circle'
    });
    const postUserEl = createEl({
        elType: 'h4',
        className: 'post-user my-3 mx-2',
        dataset: { action: Constants.ACTIONS.POST.USER_PROFILE }
    });
    const postContentEl = createEl({
        elType: 'h6',
        className: 'post-content'
    });
    const postDateEl = createEl({
        elType: 'p',
        className: 'post-date'
    });
    const postFooterEl = createEl({
        elType: 'div',
        className: 'post-footer mb-3 d-flex'
    });
    const likeCountEl = createEl({
        elType: 'span',
        className: 'like-count'
    });
    const likeContainerEl = createEl({
        elType: 'div',
        className: 'like-container'
    });
    const likeBtnEl = createEl({
        elType: 'i',
        dataset: { action: Constants.ACTIONS.POST.LIKE }
    });
    const commentCountEl = createEl({
        elType: 'span',
        className: 'comment-count',
    });
    const commentIconContainerEl = createEl({
        elType: 'div',
        className: 'comment-icon-container',
        dataset: { action: Constants.ACTIONS.POST.COMMENTS }
    });
    const commentIconEl = createEl({
        elType: 'i',
        className: 'fa-regular fa-comment'
    });

    const postCommentsEl = createEl({
        elType: 'div',
        className: 'post-comments d-none'
    });
    const commentInputContainerEl = createEl({
        elType: 'div',
        className: 'comment-input d-flex align-items-center justify-content-center'
    });
    const commentInputEl = createEl({
        elType: 'textarea',
        className: 'form-control comment',
        attributes: {
            rows: '1',
            placeholder: 'Write a new comment.',
            id: 'comment-input'
        }
    });
    const sendBtnEl = createEl({
        elType: 'button',
        textContent: 'Send',
        className: 'btn btn-primary',
        dataset: { action: Constants.ACTIONS.POST.CREATE_COMMENT }
    })
    const commentListContainerEl = createEl({
        elType: 'div',
        className: 'comment-list'
    });


    postCommentsEl.append(commentInputContainerEl, commentListContainerEl);
    commentInputContainerEl.append(commentInputEl, sendBtnEl);
    likeContainerEl.append(likeBtnEl, likeCountEl);
    commentIconContainerEl.append(commentIconEl, commentCountEl);
    postFooterEl.append(likeContainerEl, commentIconContainerEl);
    headerDivEl.append(postProfilePictureEl, postUserEl)
    postHeaderEl.append(headerDivEl);
    postBodyEl.append(postHeaderEl, postContentEl, postDateEl, postFooterEl, postCommentsEl);
    postCardEl.append(postBodyEl);
    postWrapperEl.append(postCardEl);
    responsiveContainer.appendChild(postCardEl);
    postWrapperEl.appendChild(responsiveContainer);
    return {
        postWrapperEl, postCardEl, postBodyEl,
        postHeaderEl, postUserEl, postContentEl,
        postDateEl, postFooterEl, likeCountEl,
        likeBtnEl, postProfilePictureEl, commentCountEl, commentListContainerEl
    };
};

/**
 * Creates auth related modals to be injected on a modal.
 * 
 * @returns {HTMLElement} Full layout.
 */
export const createAuthModal = (mode) => {
    // Basic layout for login
    const profileEditContainerEl = createEl({
        elType: 'div',
        className: 'profile-edit-container d-block'
    });

    const profileEditFormEl = createEl({
        elType: 'form',
        className: 'profile-edit-form'
    });
    profileEditContainerEl.append(profileEditFormEl);

    const usernameInputLabelEl = createEl({
        elType: 'label',
        textContent: 'Username: ',
        attributes: { for: 'username' }
    });
    const usernameInputEl = createEl({
        elType: 'input',
        className: 'username-input form-control',
        attributes: {
            type: 'text',
            name: 'username',
            id: 'username'
        }
    });
    const usernameFormGroupEl = createEl({
        elType: 'div',
        className: 'form-group'
    });
    usernameFormGroupEl.append(usernameInputLabelEl, usernameInputEl);
    profileEditFormEl.append(usernameFormGroupEl);

    const needsPassword = mode == 'login' || mode == 'register';
    let passwordInputEl, passwordFormGroupEl, passwordInputLabelEl;

    if (needsPassword) {
        passwordInputEl = createEl({
            elType: 'input',
            className: 'password-input form-control',
            attributes: {
                type: 'password',
                name: 'password',
                id: 'password'
            }
        });

        passwordInputLabelEl = createEl({
            elType: 'label',
            textContent: 'Password: ',
            attributes: { for: 'password' }
        });

        passwordFormGroupEl = createEl({
            elType: 'div',
            className: 'form-group my-3'
        });
        passwordFormGroupEl.append(passwordInputLabelEl, passwordInputEl);
        profileEditFormEl.append(usernameFormGroupEl, passwordFormGroupEl);
    }

    if (mode == 'login') {
        return { profileEditContainerEl, profileEditFormEl, usernameInputLabelEl, usernameInputEl, usernameFormGroupEl, passwordInputLabelEl, passwordInputEl, passwordFormGroupEl };
    }

    // Layout for the edit profile
    const previewImgEl = createEl({
        elType: 'img',
        className: 'profile-picture profile-picture-preview rounded-circle mb-2',
        attributes: { src: '' }
    });
    const previewImgContainerEl = createEl({
        elType: 'div',
        className: 'd-flex justify-content-center'
    });

    const ImageInputLabelEl = createEl({
        elType: 'label',
        textContent: 'Profile Picture:',
        attributes: { for: 'profile_picture' }
    });
    const imageInputEl = createEl({
        elType: 'input',
        className: 'profile-picture-input',
        attributes: {
            type: 'file',
            name: 'profile_picture',
            id: 'profile_picture',
            accept: 'image/png, image/jpeg, image/jpg, image/webp'
        }
    });
    const imageFormGroupEl = createEl({
        elType: 'div',
        className: 'form-group my-3'
    });
    imageFormGroupEl.append(ImageInputLabelEl, imageInputEl);
    previewImgContainerEl.append(previewImgEl);
    profileEditFormEl.prepend(imageFormGroupEl);
    profileEditContainerEl.prepend(previewImgContainerEl);

    const emailInputLabelEl = createEl({
        elType: 'label',
        textContent: 'Email',
        attributes: { for: 'email' }
    });
    const emailInputEl = createEl({
        elType: 'input',
        className: 'email-input form-control',
        attributes: {
            type: 'text',
            name: 'email',
            id: 'email'
        }
    });
    const emailFormGroupEl = createEl({
        elType: 'div',
        className: 'form-group my-3'
    });
    emailFormGroupEl.append(emailInputLabelEl, emailInputEl);
    profileEditFormEl.append(emailFormGroupEl);

    if (mode == 'edit-profile') {
        return {
            profileEditContainerEl, profileEditFormEl, usernameInputLabelEl, usernameInputEl, usernameFormGroupEl, passwordInputLabelEl, passwordInputEl, passwordFormGroupEl,
            previewImgEl, previewImgContainerEl, ImageInputLabelEl, imageInputEl, imageFormGroupEl, emailInputLabelEl, emailInputEl, emailFormGroupEl
        };
    }

    // Full layout for registration
    const confirmationInputLabelEl = createEl({
        elType: 'label',
        textContent: 'Confirm Password: ',
        attributes: { for: 'confirmation' }
    });

    const confirmationInputEl = createEl({
        elType: 'input',
        className: 'confirmation-input form-control',
        attributes: {
            type: 'password',
            name: 'confirmation',
            id: 'confirmation'
        }
    });

    const confirmationFormGroupEl = createEl({
        elType: 'div',
        className: 'form-group my-3'
    });
    confirmationFormGroupEl.append(confirmationInputLabelEl, confirmationInputEl);
    passwordFormGroupEl.after(confirmationFormGroupEl);

    profileEditContainerEl.append(profileEditFormEl);

    return {
        profileEditContainerEl, profileEditFormEl, usernameInputLabelEl, usernameInputEl, usernameFormGroupEl, passwordInputLabelEl, passwordInputEl, passwordFormGroupEl,
        previewImgEl, previewImgContainerEl, ImageInputLabelEl, imageInputEl, imageFormGroupEl, emailInputLabelEl, emailInputEl, emailFormGroupEl, confirmationInputLabelEl, confirmationInputEl, confirmationFormGroupEl
    };
};

/**
 * Creates the edit layout for posts.
 * 
 * @returns {HTMLElement} The textarea and the edit layout
 */
export const createPostEditLayout = () => {
    const textareaEl = createEl({
        elType: 'textarea',
        className: 'form-control post-edit-textarea'
    });

    const saveBtnEl = createEl({
        elType: 'button',
        className: 'btn btn-primary save-btn',
        textContent: 'Save',
        dataset: { action: Constants.ACTIONS.POST.SAVE_EDIT }
    });

    const cancelBtnEl = createEl({
        elType: 'button',
        className: 'btn btn-danger cancel-btn',
        textContent: 'Cancel',
        dataset: { action: Constants.ACTIONS.POST.CANCEL_EDIT }
    });

    const buttonsContainerEl = createEl({
        elType: 'div',
        className: 'd-flex mt-3',
        attributes: {
            style: 'gap: 12px; align-items: center;'
        }
    });
    buttonsContainerEl.append(saveBtnEl, cancelBtnEl);

    const postEditContainerEl = createEl({
        elType: 'div',
        className: 'post-edit-container'
    });

    postEditContainerEl.append(textareaEl, buttonsContainerEl);

    return { textareaEl, postEditContainerEl };
};

/**
 * Creates a styled message box for main notifications.
 * 
 * @param {string} message - The message text
 * @returns {HTMLElement} The message container
 */
export const createMainMessage = (message, type) => {
    const mainMessageEl = createEl({
        elType: "div",
        className: `alert alert-${type} d-flex align-items-center justify-content-center p-3 border border-1 shadow w-50`,
        attributes: { role: "alert" }
    });

    const iconEl = createEl({
        elType: "i",
        className: "fa-solid fa-circle-exclamation me-2"
    });

    const messageEl = createEl({
        elType: "span",
        textContent: message
    });

    mainMessageEl.append(iconEl, messageEl);
    return mainMessageEl;
};

/**
 * Creates the layout for a single comment.
 *
 * @returns {HTMLElement} Comment ready to be filled
 */
export const createCommentLayout = () => {
    const commentWrapperEl = createEl({
        elType: 'div',
        className: 'comment-wrapper d-flex align-items-start p-2 border border-1 shadow'
    });
    const commentAvatarEl = createEl({
        elType: 'img',
        className: 'comment-profile-picture rounded-circle my-1',
    });
    const commentBodyEl = createEl({
        elType: 'div',
        className: 'comment-body flex-grow-1 mx-2'
    });
    const commentHeaderWrapperEl = createEl({
        elType: 'div',
        className: 'comment-header-wrapper d-flex justify-content-between align-items-start'
    });
    const commentHeaderEl = createEl({ elType: 'div', className: 'comment-header d-flex align-items-center' });
    const commentAuthorEl = createEl({
        elType: 'strong',
        className: 'comment-author mx-2',
        dataset: { action: Constants.ACTIONS.POST.COMMENT_USER_PROFILE }
    });
    const commentTextEl = createEl({
        elType: 'span',
        className: 'comment-text'
    });
    const commentTimestampEl = createEl({
        elType: 'small',
        className: 'comment-timestamp mx-2'
    });

    commentHeaderWrapperEl.append(commentHeaderEl);
    commentHeaderEl.append(commentAuthorEl, commentTextEl);
    commentBodyEl.append(commentHeaderEl, commentTimestampEl);
    commentWrapperEl.append(commentAvatarEl, commentBodyEl);

    return { commentWrapperEl, commentAvatarEl, commentAuthorEl, commentTextEl, commentTimestampEl, commentBodyEl: commentBodyEl, commentHeaderEl: commentHeaderEl };
};

/**
 * Creates the edit layout for comments.
 * 
 * @param {string} originalContent - Original content from the comment
 * @returns {HTMLElement} Full comment edit layout
 */
export const createCommentEditLayout = (originalContent = '') => {
    const wrapperEl = createEl({
        elType: 'div',
        className: 'comment-edit d-flex align-items-center flex-grow-1'
    });

    const textareaEl = createEl({
        elType: 'textarea',
        className: 'comment-textarea form-control form-control-sm flex-grow-1 me-2',
        textContent: originalContent,
        rows: 1
    });

    const saveBtnEl = createEl({
        elType: 'button',
        className: 'btn btn-sm btn-primary me-1',
        textContent: 'Save',
        dataset: { action: Constants.ACTIONS.COMMENT.SAVE_EDIT }
    });

    const cancelBtnEl = createEl({
        elType: 'button',
        className: 'btn btn-sm btn-danger',
        textContent: 'Cancel',
        dataset: { action: Constants.ACTIONS.COMMENT.CANCEL_EDIT }
    });

    wrapperEl.append(textareaEl, saveBtnEl, cancelBtnEl);

    return { wrapperEl, textareaEl, saveBtnEl, cancelBtnEl };
};

export const UI = {
    createEl,
    createBaseModal,
    createDropdown,
    createPostLayout,
    createAuthModal,
    createPostEditLayout,
    createMainMessage,
    createCommentLayout,
    createCommentEditLayout,
    spinner
};