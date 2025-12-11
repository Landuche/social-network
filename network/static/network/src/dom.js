/**
 * dom.js
 * DOM utilities and state-based layout management.
 * - Caches static DOM references 
 * - Provides helpers for modals, messages, dropdowns
 * - Controls visibility/layout based on App.State filters
 * - Acts as a bridge between UI scaffolding and user interaction
 */

import { State } from './state.js';
import { FILTERS, Styles } from './constants.js';
import { UI } from './ui.js';
import { Animations } from './animations.js';
import {
    checkArgs,
    clearElement,
    awaitFrame,
    handleOutsideClick,
    wait
} from './utils.js';
import { Post } from './post.js';
import { updateNavbar } from './header.js';
import { clearPostsFeed } from './post-helpers.js';

/**
 * Cache layout static DOM elements.
 */
export const DOM = {};

/**
 * Cache index static DOM elements.
 */
export const initIndex = () => {
    DOM.appContainer = document.getElementById('network-app');
    DOM.profileCard = document.getElementById('profile-card');
    DOM.postsFeed = document.getElementById('posts-feed');
    DOM.newPostContainer = document.getElementById('new-post-form-container');
    DOM.newPostForm = document.getElementById('post-form');
    DOM.newPostSubmitBtn = document.getElementById('submit-post');
    DOM.newPostContent = document.getElementById('form-text');
    DOM.followingButton = document.getElementById('following');
    DOM.followersCount = document.getElementById('followers-count-value');
    DOM.followingCount = document.getElementById('following-count-value');
    DOM.profileHeader = document.getElementById('profile-header');
    DOM.profileName = document.getElementById('profile-name');
    DOM.profilePicture = document.getElementById('profile-picture');
    DOM.messageContainer = document.getElementById('message-container');
    DOM.profilePostsCount = document.getElementById('post-count-value');
    DOM.modalContainer = document.getElementById('modal-container');
};

// Maps spinner elements and respective elements 
let spinnerBtns = new WeakMap();

export const DOMUtils = {

    /**
     * Insert a temporary message after a given element.
     * - Uses App.Animations for fade in/out
     * - Only one message shown per element at a time
     * @param {HTMLElement} element - Target element
     * @param {string} message - Message text
     * @param {string} [color="danger"] - Bootstrap color
     */
    addElMessage: async (element, message, { color = 'danger', position = 'afterend' } = {}) => {
        if (!checkArgs({ element, message }, 'DOMUtils.addElMessage')) return;

        DOMUtils.removeElMessage(element);

        const div = UI.createEl({ elType: 'div', className: `message text-${color} mt-1`, textContent: message });

        element.insertAdjacentElement(position, div);
        await Animations.play(Animations.Names.fadeInExpand, div);
        await wait(3000);
        await Animations.play(Animations.Names.fadeOutShrink, div);
        div.remove();
    },

    /**
     * Removes a message after a given element.
     * @param {HTMLElement} element - Target element 
     */
    removeElMessage: (element) => {
        if (!element) return;

        const container = element.parentElement;
        if (!container) return;
        const message = container.querySelector('.message');
        if (message) {
            message.remove();
        }
    },

    /**
     * Toggle dropdown menu visibility with animations.
     * - Opens with slide down
     * - Toggles App.State.dropdownLock
     * - Closes on outside click or item click
     * @param {HTMLElement} dropdownBtnEl - The button that triggered the dropdown
     */
    toggleDropdown: async (dropdownBtnEl) => {
        if (!checkArgs(dropdownBtnEl, 'DOMUtils.toggleDropdown')) return;

        const dropdownWrapperEl = dropdownBtnEl.closest('.dropdown-wrapper');
        if (!dropdownWrapperEl) {
            console.warn('DOMUtils.toggleDropdown: Invalid dropdown wrapper.');
            return;
        };

        const dropdownMenuEl = dropdownWrapperEl.querySelector('.dropdown-menu');
        if (!dropdownMenuEl) {
            console.warn('DOMUtils.toggleDropdown: Invalid dropdown menu.');
            return;
        };

        const isHidden = dropdownMenuEl.classList.contains('d-none');

        const closeDropdown = async () => {
            State.dropdownLock = true;
            await Animations.play(Animations.Names.fadeOutSlideUp, dropdownMenuEl);
            dropdownMenuEl.classList.add('d-none');
        };

        if (isHidden) {
            dropdownMenuEl.classList.remove('d-none');
            await awaitFrame();
            await Animations.play(Animations.Names.fadeInSlideDown, dropdownMenuEl);
            State.dropdownLock = false;

            // Attach event listener to close the dropdown if clicking outside of it
            handleOutsideClick(dropdownWrapperEl, closeDropdown, 'dropdown-item');
        } else {
            await closeDropdown();
        }
    },

    /**
     * Clear all main containers and display a centered message.
     * - Marks App.State.showMessage = true
     * - Appends message to messageContainer
     * @param {string} message - Message text to display
     */
    displayMainMessage: (message, type = "danger") => {
        if (!message) {
            console.error('DOMUtils.displayMainMessage: Invalid message.');
            return;
        }

        clearElement(DOM.messageContainer);
        clearPostsFeed();

        State.showMessage = true;

        const mainMessageEl = UI.createMainMessage(message, type);
        DOM.messageContainer.appendChild(mainMessageEl);

        DOMUtils.updateLayout();
    },

    /**
     * Show/hide static containers depending on App.State.currentFilter.
     * - Checks App.State.showMessage to handle message container
     * - Marks App.State.showMessage = false
     * - Controls new post form, profile card, and message container
     */
    updateLayout: () => {
        State.showMessage ? DOM.messageContainer?.classList.remove('hidden') : DOM.messageContainer?.classList.add('hidden');
        State.showMessage = false;

        switch (State.currentFilter) {
            case FILTERS.ALL:
                DOM.newPostContainer?.classList.remove('d-none');
                DOM.profileCard?.classList.add('d-none');
                break;
            case FILTERS.FOLLOWING:
                DOM.newPostContainer?.classList.add('d-none');
                DOM.profileCard?.classList.add('d-none');
                break;
            case FILTERS.PROFILE:
                DOM.newPostContainer?.classList.add('d-none');
                DOM.profileCard?.classList.remove('d-none');
                break;

            default:
                DOM.newPostContainer?.classList.remove('d-none');
                DOM.profileCard?.classList.add('d-none');
                DOM.messageContainer?.classList.add('d-none');
                console.log(`Invalid filter: ${State.currentFilter}`);
                break;
        }
    },

    /**
     * Remove modal contents from modal container.
     */
    closeModal: () => {
        clearElement(DOM.modalContainer);
    },

    /**
     * Sets up the IntersectionObserver for infinite scrolling.
     * 
     * - Ensure a sentinel exists at the bottom of the posts feed
     * - If a previous observer exists, safely detach it before creating a new one
     * - Stored at State 
     */
    initInfiniteScroll: () => {
        let sentinel = document.getElementById('infinite-scroll-sentinel');
        if (!sentinel) {
            sentinel = UI.createEl({
                elType: 'div',
                className: 'infinite-scroll-sentinel',
                attributes: { id: 'infinite-scroll-sentinel', style: 'width: 100%;' }
            });
            DOM.postsFeed.append(sentinel);
        }

        if (State.scrollObserver) State.scrollObserver.unobserve(sentinel);

        const observerCallback = (entries) => {
            const entry = entries[0];

            if (entry.isIntersecting && State.hasNextPost && !State.postsLoading) {
                Post.loadMorePosts();
            }
        };

        const options = {
            root: null,
            rootMargin: '0px 0px 500px 0px',
            threshold: 0.0
        };

        const observer = new IntersectionObserver(observerCallback, options);

        observer.observe(sentinel);

        State.scrollObserver = observer;
    },

    /**
     * Disconnects the infinite scroll observer.
     */
    cleanObserver: () => {
        if (State.scrollObserver) {
            State.scrollObserver.disconnect();
            State.scrollObserver = null;
        }
    },

    /**
     * Toggles the loading state for the infinite scroll sentinel.
     */
    toggleSentinelLoading: (isLoading, sentinel) => {
        if (sentinel) {
            sentinel.classList.toggle('is-loading', isLoading);
        }
        State.postsLoading = isLoading;
    },

    refreshProfilePictures: () => {
        const defaultPicture = window.getDefaultProfilePicture();

        document.querySelectorAll('.nav-profile-picture, .post-profile-picture, .comment-profile-picture, .profile-picture').forEach(picture => {
            if (picture.src.includes('default_profile')) {
                picture.src = defaultPicture;
            }
        })
    },

    /**
     * Applies the current theme to the document.
     * - Toggles the root HTML class
     * - Save theme choice in localStorage
     * - Updates navbar and toggle icon styles
     */
    handleTheme: () => {
        const isDark = State.darkTheme;

        document.documentElement.classList.toggle('dark-mode', isDark);
        localStorage.setItem('isDark', isDark ? 'true' : 'false');
        if (isDark) {
            DOM.navbar.className = Styles.DARK_MODE_NAV;
            DOM.themeIcon.className = Styles.DARK_MODE_TOGGLE;
        } else {
            DOM.navbar.className = Styles.WHITE_MODE_NAV;
            DOM.themeIcon.className = Styles.WHITE_MODE_TOGGLE;
        }
        updateNavbar();
        DOMUtils.refreshProfilePictures();
    },

    /**
     * Sets up the listener for the theme toggle button.
     * - Update State
     * - Call handleTheme to apply the new theme
     */
    toggleThemeListener: () => {
        DOM.themeToggle.addEventListener('click', () => {
            State.darkTheme = !State.darkTheme;
            DOMUtils.handleTheme();
        });
    },

    /**
     * Replaces a given element with a centered loading spinner.
     * - Copies styles to preserve positioning
     * - Stores the original element so it can be restored later
     * @param {HTMLElement} el - Element to replace with a spinner
     * @returns {HTMLElement} - The spinner element
     */
    addSpinner: (el) => {
        const spinner = UI.spinner();

        // Copy previous element styles
        const styles = getComputedStyle(el);
        const copyStyles = ['position', 'top', 'right', 'bottom', 'left',
            'width', 'height', 'minWidth', 'maxWidth',
            'margin', 'padding',
            'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'order', 'alignSelf',
            'transform', 'zIndex'];

        copyStyles.forEach(prop => {
            spinner.style[prop] = styles[prop];
        });

        // Fix spinner on the center of the sent element
        spinner.style.flexShrink = '0';
        spinner.style.display = 'flex';
        spinner.style.alignItems = 'center';
        spinner.style.justifyContent = 'center';

        const parent = el.parentNode;

        parent.replaceChild(spinner, el);
        spinnerBtns.set(spinner, el);

        return spinner;
    },

    /**
     * Restores the original element previously replaced by addSpinner().
     * @param {HTMLElement} spinner - Spinner element 
     */
    removeSpinner: (spinner) => {
        const btn = spinnerBtns.get(spinner);
        if (btn) {
            spinner.parentNode.replaceChild(btn, spinner);
            spinnerBtns.delete(spinner);
        }
    }
};