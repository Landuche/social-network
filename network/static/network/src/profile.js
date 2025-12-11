/**
 * profile.js
 * Handles user profile functionality.
 * - Fetches and renders profile data
 * - Manages follow/unfollow actions
 * - Updates profile-related DOM elements
 */

import { ACTIONS, FILTERS, MESSAGES, Styles } from './constants.js';
import { State } from './state.js';
import { API } from './api.js';
import { DOM, DOMUtils } from './dom.js';
import { UI } from './ui.js';
import { Post } from './post.js';
import { updateNavbar } from './header.js';
import {
    checkArgs,
    checkUserAuth,
    validateUsername,
    validateEmail,
    validateImage,
    validatePassword
} from './utils.js';

/**
 * Delegate click events on the profile card.
 * - Determine action using dataset
 */
const delegate = () => {
    DOM.profileCard.addEventListener('click', (event) => {
        const target = event.target;
        const targetAction = target.closest('[data-action]');
        if (!targetAction) return;
        const action = targetAction.dataset.action;
        if (!action) return;

        if (action === ACTIONS.PROFILE.FOLLOW) followUser(targetAction);
        if (action === ACTIONS.PROFILE.EDIT) showAuthModal(targetAction, 'edit-profile');
    })
};


async function showAuthModal(el, mode = 'login', event = null) {
    if (event) event.preventDefault();
    if (document.querySelector('.modal-overlay')) return;

    document.documentElement.style.overflow = 'hidden';

    // Create modal
    const { modalOverlayEl, modalTitleEl, modalBodyEl, saveBtnEl, cancelBtnEl } = UI.createBaseModal();

    const config = {
        'login': { title: 'Login', button: 'Login' },
        'register': { title: 'Register', button: 'Register' },
        'edit-profile': { title: 'Edit Profile', button: 'Save' },
    }[mode];

    const fields = UI.createAuthModal(mode);
    modalBodyEl.appendChild(fields.profileEditContainerEl);

    modalTitleEl.textContent = config.title;
    saveBtnEl.textContent = config.button;
    if (mode != 'login') fields.previewImgEl.src = window.getDefaultProfilePicture();

    let currentEmail;
    if (mode === 'edit-profile') {
        currentEmail = await populateEditProfileModal(fields, saveBtnEl);
    }

    const handlers = {
        'login': () => handleLogin(fields, saveBtnEl, cancelBtnEl),
        'register': () => handleRegister(fields, saveBtnEl, cancelBtnEl),
        'edit-profile': () => saveProfileEdit(fields, currentEmail, saveBtnEl, cancelBtnEl),
    }

    const revertOverflow = () => {
        document.documentElement.style.overflow = '';
    }

    saveBtnEl.addEventListener('click', async () => {
        try {
            await handlers[mode]();
        } finally {
            revertOverflow();
        }
    })
    cancelBtnEl.addEventListener('click', revertOverflow);

    if (fields.imageInputEl) {
        addProfileImagePreview(fields.imageInputEl, fields.previewImgEl);
    }

    DOM.modalContainer.append(modalOverlayEl);
}

export const handleLogout = async (event) => {
    event.preventDefault();
    await API.logout();
    State.userIsAuthenticated = false;
    State.currentUserId = null;
    State.currentUsername = null;
    State.currentUserProfilePicture = window.getDefaultProfilePicture();
    updateNavbar();
    Post.loadPosts({ filter: FILTERS.ALL });
}

export const handleLogin = async (fields, loginBtnEl, cancelBtnEl) => {
    if (!checkArgs({ fields, loginBtnEl, cancelBtnEl }, 'saveProfileEdit')) return;

    const formData = new FormData();

    const username = fields.usernameInputEl.value.trim();
    if (!username) {
        DOMUtils.addElMessage(fields.usernameInputEl, MESSAGES.ERROR_EMPTY_FIELD);
        return;
    }
    formData.append('username', username);
    const password = fields.passwordInputEl.value.trim();
    if (!password) {
        DOMUtils.addElMessage(fields.passwordInputEl, MESSAGES.ERROR_EMPTY_FIELD);
        return;
    }
    formData.append('password', password);

    if (!formData.entries().next().done) {
        const spinner = DOMUtils.addSpinner(loginBtnEl);
        try {
            const { user_id, username, profile_picture } = await API.login(formData);

            State.userIsAuthenticated = true;
            State.currentUserId = user_id;
            State.currentUsername = username;
            State.currentUserProfilePicture = profile_picture;
            updateNavbar();
            DOMUtils.removeSpinner(spinner);
            DOMUtils.closeModal();
            updateNavbar();
            Post.loadPosts({ filter: FILTERS.ALL });
        } catch (error) {
            if (fields.profileEditContainerEl) DOMUtils.addElMessage(fields.profileEditContainerEl, error.message);
            console.error(error);
        } finally {
            DOMUtils.removeSpinner(spinner);
        }
    }
}

const populateEditProfileModal = async (fields, saveBtnEl) => {
    if (!checkUserAuth()) return;

    // Get data to fill the edit profile layout
    fields.previewImgEl.src = DOM.profilePicture.src;
    fields.usernameInputEl.value = DOM.profileName.textContent;

    let currentEmail = ''

    const spinner = DOMUtils.addSpinner(saveBtnEl);

    try {
        currentEmail = await getUserEmail();
        fields.emailInputEl.value = currentEmail;
    } catch (error) {
        fields.emailInputEl.value = '';
        fields.emailInputEl.disabled = true;
    }

    DOMUtils.removeSpinner(spinner);

    return currentEmail;
}

/**
 * Fetch the email of the user currently displayed on the profile card.
 * @returns {Promise<string>} - User's email
 */
async function getUserEmail() {
    const userId = DOM.profileCard.dataset.userId;
    const { email } = await API.getUserEmail(userId);
    return email;
};

/**
 * Adds live preview for selected profile image.
 * - Updates preview element when file input changes
 * @param {HTMLInputElement} fileInputEl - Input element for profile picture
 * @param {HTMLImageElement} previewImgEl - Image element to show preview
 */
function addProfileImagePreview(fileInputEl, previewImgEl) {
    if (!fileInputEl || !previewImgEl) return;

    fileInputEl.addEventListener('change', () => {
        const file = fileInputEl.files[0];
        if (!file || !file.type.startsWith('image/')) {
            previewImgEl.src = DOM.profilePicture.src;
            return;
        }

        const imageURL = URL.createObjectURL(file);
        previewImgEl.src = imageURL;

        previewImgEl.onload = () => URL.revokeObjectURL(imageURL);
    });
}

/**
 * Save edited profile information.
 * - Validates input fields
 * - Sends FormData to API
 * - Updates profile on success
 * - Handles errors and re-enables buttons
 * @param {HTMLInputElement} imageInputEl - Profile picture input
 * @param {HTMLInputElement} usernameInputEl - Username input
 * @param {HTMLInputElement} emailInputEl - Email input
 * @param {HTMLButtonElement} saveBtnEl - Save button
 * @param {HTMLButtonElement} cancelBtnEl - Cancel button
 */
async function saveProfileEdit(fields, currentEmail, saveBtnEl, cancelBtnEl) {
    if (!checkArgs({ fields, saveBtnEl, cancelBtnEl }, 'saveProfileEdit')) return;
    if (!checkUserAuth()) return;

    const formData = new FormData();

    // Validate data before fetch
    const userId = DOM.profileCard.dataset.userId;
    if (userId != State.currentUserId) {
        DOMUtils.addElMessage(fields.emailInputEl, MESSAGES.ERROR);
        console.error(MESSAGES.profile.errors.dev.INVALID_ID);
        return;
    }

    const username = fields.usernameInputEl.value.trim();
    const usernameValidation = validateUsername(username);
    if (usernameValidation.error) {
        DOMUtils.addElMessage(fields.usernameInputEl, usernameValidation.message);
        return;
    }

    const email = fields.emailInputEl.value.trim().toLowerCase();
    const emailValidation = validateEmail(email);
    if (emailValidation.error) {
        DOMUtils.addElMessage(fields.emailInputEl, emailValidation.message);
        return
    }

    const fileInput = fields.imageInputEl;
    if (fileInput.files[0]) {
        const pictureValidation = validateImage(fileInput.files[0]);
        if (pictureValidation.error) {
            DOMUtils.addElMessage(fields.imageInputEl, pictureValidation.message);
            return;
        }
        formData.append('profile_picture', fileInput.files[0]);
    }

    // Add data to form
    if (username !== State.currentUsername) formData.append('username', username);
    if (email != currentEmail) formData.append('email', email);

    // Fetch only if any info changed
    if (!formData.entries().next().done) {
        const spinner = DOMUtils.addSpinner(saveBtnEl);
        try {
            // Fetch
            const { success, profile_picture } = await API.editProfile(formData);
            if (success) {
                if (username) State.currentUsername = username;
                if (profile_picture) State.currentUserProfilePicture = profile_picture;
                DOMUtils.removeSpinner(spinner);
                DOMUtils.closeModal();
                loadProfile(State.currentUserId);
                DOMUtils.addElMessage(DOM.profileHeader, MESSAGES.profile.success.ui.SUCCESS_PROFILE_EDIT, { color: 'success' });
            }
        } catch (error) {
            if (fields.profileEditContainerEl) DOMUtils.addElMessage(fields.profileEditContainerEl, error.message);
            console.error(error);
        } finally {
            DOMUtils.removeSpinner(spinner);
            updateNavbar();
            saveBtnEl.disabled = false;
            cancelBtnEl.disabled = false;
        }
    }
};

/**
 * Set follow button style based on follow state.
 * @param {HTMLElement} el - Button element
 * @param {boolean} follow - True if following, false if not
 */
function setFollowBtnStyle(el, follow) {
    if (!checkArgs({ el, follow }, 'setFollowBtnStyle')) return;

    const style = follow ? Styles.buttons.UNFOLLOW : Styles.buttons.FOLLOW;

    el.className = style.className;
    el.textContent = style.textContent;
};

/**
 * Populate profile DOM elements with user data.
 * - Incorrect post count is defaulted to 0
 * @param {Object} data - Profile data
 */
function fillProfile(data) {
    // Remove previous profile image to improve low end experience
    DOM.profilePicture.src = '';

    DOM.profileName.textContent = data.username;
    DOM.profilePicture.src = data.profile_picture ? data.profile_picture : window.getDefaultProfilePicture();
    DOM.followersCount.textContent = `${data.followers}`;
    DOM.followingCount.textContent = `${data.following}`;
    DOM.profilePostsCount.textContent = data.post_count == undefined ? `0` : `${data.post_count}`;
};


/**
 * Toggle follow/unfollow user and update profile DOM.
 * - Disables button during request
 * - Checks authentication
 * - Calls API to toggle follow state
 * - Updates button and followers count
 * - Handles errors with console and UI message
 * @param {HTMLElement} followBtnEl 
 */
async function followUser(followBtnEl) {
    if (!checkArgs({ followBtnEl }, 'followUser') || followBtnEl.disabled) return;
    if (!checkUserAuth()) return;

    const spinner = DOMUtils.addSpinner(followBtnEl);

    const userId = DOM.profileCard.dataset.userId;

    try {
        if (!userId || userId === State.currentUserId) throw new Error(MESSAGES.profile.errors.dev.INVALID_DATA);

        const { follow, followers_count } = await API.followUser(userId);

        setFollowBtnStyle(followBtnEl, follow);
        DOM.followersCount.textContent = followers_count;
    } catch (error) {
        console.error('followUser:', error);
        DOMUtils.addElMessage(DOM.profileHeader, MESSAGES.profile.errors.ui.ERROR_FOLLOWING_USER);
    } finally {
        DOMUtils.removeSpinner(spinner);
    }
};

/**
 * Render a user profile on the page.
 * - Attach user id on profile card
 * - Clears previous profile buttons
 * - Handles the creation of the profile buttons
 * @param {Object} data - Profile data
 */
function renderProfile(data) {
    // Attach user id on profile card
    DOM.profileCard.dataset.userId = data.id;

    // Clear previous profile button
    const oldBtnEl = DOM.profileCard.querySelector('.btn');
    if (oldBtnEl) oldBtnEl.remove();

    // Conditionally create profile button
    if (State.userIsAuthenticated) {
        if (data.id != State.currentUserId) {
            createFollowButton(data.follow);
        } else {
            createEditProfileButton();
        }
    }

    fillProfile(data);
};

/**
 * Create and append an edit profile button for the current user.
 */
function createEditProfileButton() {
    const editBtnEl = UI.createEl(Styles.buttons.EDIT_PROFILE);
    DOM.profileHeader.append(editBtnEl);
};


/**
 * Create and attach a follow/unfollow button to the profile header.
 * 
 * @param {boolean} isFollowing - Current follow state
 */
const createFollowButton = (isFollowing) => {
    if (!checkArgs({ isFollowing }, 'createFollowButton')) return;

    const followBtnEl = UI.createEl({ elType: 'button', dataset: { action: ACTIONS.PROFILE.FOLLOW } });
    setFollowBtnStyle(followBtnEl, isFollowing)

    DOM.profileHeader.append(followBtnEl);
};

/**
 * Load and render a profile by user ID.
 * - Updates current filter to PROFILE
 * - Updates layout for profile view
 * - Fetches user data from API
 * - Renders profile and user's posts
 * - Handles errors with console and ui message
 * @param {number} userId - ID of the user to load
 */
const loadProfile = async (userId) => {
    if (!checkArgs({ userId }, 'loadProfile')) {
        DOMUtils.displayMainMessage(MESSAGES.profile.errors.ui.ERROR_LOADING_PROFILE);
        return;
    }
    // Set current filter
    State.currentFilter = FILTERS.PROFILE;

    document.body.classList.remove('loaded');

    // Get user data from API and send to renderPosts
    try {
        const data = await API.fetchProfile(userId);
        renderProfile(data);
        Post.loadPosts({ viewProfileUserId: userId, filter: FILTERS.PROFILE });
        DOMUtils.updateLayout();
        document.body.classList.add('loaded');
    } catch (error) {
        DOMUtils.displayMainMessage(MESSAGES.profile.errors.ui.ERROR_LOADING_PROFILE);
        console.error('loadProfile:', error);
    }
};



export const handleRegister = async (fields, saveBtnEl, cancelBtnEl) => {
    if (!checkArgs({ fields, saveBtnEl, cancelBtnEl }, 'saveProfileEdit')) return;

    const formData = new FormData();

    const username = fields.usernameInputEl.value.trim();
    const usernameValidation = validateUsername(username);
    if (usernameValidation.error) {
        DOMUtils.addElMessage(fields.usernameInputEl, usernameValidation.message);
        return;
    }
    formData.append('username', username);

    const email = fields.emailInputEl.value.trim().toLowerCase();
    const emailValidation = validateEmail(email);
    if (emailValidation.error) {
        DOMUtils.addElMessage(fields.emailInputEl, emailValidation.message);
        return;
    }
    formData.append('email', email);

    const password = fields.passwordInputEl.value.trim();
    const confirmation = fields.confirmationInputEl.value.trim();
    const passwordValidation = validatePassword(password, confirmation);
    if (passwordValidation.error) {
        DOMUtils.addElMessage(fields.confirmationInputEl, passwordValidation.message);
        return;
    }
    formData.append('password', password);
    formData.append('confirmation', confirmation);

    const fileInput = fields.imageInputEl;
    if (fileInput.files[0]) {
        const pictureValidation = validateImage(fileInput.files[0]);
        if (pictureValidation.error) {
            DOMUtils.addElMessage(fields.imageInputEl, pictureValidation.message);
            return;
        }
        formData.append('profile_picture', fileInput.files[0]);
    }

    if (!formData.entries().next().done) {
        const spinner = DOMUtils.addSpinner(saveBtnEl);
        try {
            const { user_id, username, profile_picture } = await API.register(formData);

            State.userIsAuthenticated = true;
            State.currentUserId = user_id;
            State.currentUsername = username;
            State.currentUserProfilePicture = profile_picture;
            updateNavbar();
            DOMUtils.removeSpinner(spinner);
            DOMUtils.closeModal();
            updateNavbar();
            Post.loadPosts({ filter: FILTERS.ALL });
        } catch (error) {
            if (fields.profileEditContainerEl) DOMUtils.addElMessage(fields.profileEditContainerEl, error.message);
            console.error(error);
        } finally {
            DOMUtils.removeSpinner(spinner);
        }
    }
}

export const ProfileUtils = {
    delegate,
    loadProfile,
    createFollowButton,
    showAuthModal
};