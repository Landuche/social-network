/**
 * header.js
 * Handles the site header interactions.
 * - Changes filters for posts
 * - Redirects to index page if necessary
 */

import { DOM, DOMUtils } from './dom.js';
import { State } from './state.js';
import { FILTERS } from './constants.js';
import { ProfileUtils, handleLogout } from './profile.js';
import { Post } from './post.js';
import { handleOutsideClick } from './utils.js';

/**
 * Handle clicks on header buttons.
 * - Prevents default link behavior
 * - Disables the button to prevent multiple clicks
 * - Redirects to the homepage if not already on it
 * - Loads the corresponding posts or user profile
 * - Re-enables the button after the action completes
 * @param {string} filter - The filter to apply (ALL, FOLLOWING, PROFILE)
 * @param {Event} event - Click event object
 * @param {HTMLElement} btn - The button that was clicked
 */
async function handleHeaderClick(filter, event, btn) {
    event.preventDefault();

    btn.classList.add('disabled-link');
    try {
        if (filter === FILTERS.PROFILE) {
            // Load the current user's profile
            await ProfileUtils.loadProfile(State.currentUserId);
        } else {
            // Load posts based on the filter (ALL or FOLLOWING)
            await Post.loadPosts({ filter: filter });
        }
    } finally {
        btn.classList.remove('disabled-link');
    }
};

/**
 * Initialize header buttons and event listeners.
 * - Caches DOM elements for header buttons if user is logged in
 * - Attaches click event handlers to change post filters
 */
const init = () => {
    // Cache navbar
    DOM.loginBtn = document.getElementById('login');
    DOM.logoutBtn = document.getElementById('logout');
    DOM.registerBtn = document.getElementById('register');
    DOM.navbarFollowingBtn = document.getElementById('following');
    DOM.userMenu = document.getElementById('user-menu');
    DOM.navbarProfilePicture = document.getElementById('nav-profile-picture');
    DOM.navbarUsername = document.getElementById('nav-username');
    DOM.mainNavLinks = document.getElementById('main-nav-links');
    DOM.followingBtn = document.getElementById('following');
    DOM.brandBtn = document.getElementById('brand');
    DOM.allPostsBtn = document.getElementById('all');
    DOM.themeToggle = document.getElementById('theme-toggle');
    DOM.themeIcon = document.getElementById('theme-icon');
    DOM.navbar = document.getElementById('navbar');
    DOM.navbarCollapse = document.getElementById('responsive-nav-menu');

    DOM.newPostRow = document.getElementById('new-post-row');


    // Header button click handlers
    DOM.brandBtn?.addEventListener('click', event => handleHeaderClick(FILTERS.ALL, event, DOM.brandBtn));
    DOM.allPostsBtn?.addEventListener('click', event => handleHeaderClick(FILTERS.ALL, event, DOM.allPostsBtn));
    DOM.registerBtn?.addEventListener('click', event => ProfileUtils.showAuthModal(DOM.registerBtn, 'register', event));
    DOM.loginBtn?.addEventListener('click', event => ProfileUtils.showAuthModal(DOM.loginBtn, 'login', event));
    DOM.logoutBtn?.addEventListener('click', event => handleLogout(event));

    DOM.userMenu?.addEventListener('click', (event) => handleHeaderClick(FILTERS.PROFILE, event, DOM.navbarUsername));
    DOM.followingBtn?.addEventListener('click', event => handleHeaderClick(FILTERS.FOLLOWING, event, DOM.followingBtn));

    updateNavbar();
    DOMUtils.toggleThemeListener();
    attachNavbarCollapseHandler();
};

/**
 * Handles Bootstrap navbar collapse logic.
 * - Ensures the collapse auto-closes when screen resizes to desktop width
 */
const attachNavbarCollapseHandler = () => {
    if (!DOM.navbarCollapse) return;

    let handler = null;

    // Hide the bootstrap dropdown
    const closeNavbar = async () => {
        const collapseInstance = bootstrap.Collapse.getInstance(DOM.navbarCollapse);
        if (collapseInstance) collapseInstance.hide();
    };

    // Add eventlistener and set handler reference when navbar expands
    const onNavbarShown = () => {
        handleOutsideClick(DOM.navbarCollapse, closeNavbar, 'nav-link');
        document.addEventListener('click', handleOutsideClick)
        handler = closeNavbar;
    };

    // Remove eventlistener and clear handler reference when navbar collapse
    const onNavbarHidden = () => {
        if (handler) {
            document.removeEventListener('click', handler);
            handler = null;
        }
    };

    // Close dropdown on window resize
    const trackWindowResize = () => {
        let resizeTimer;
        const DEBOUNCE_DELAY = 100;
        const XL_SCREEN_SIZE = 1200;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);

            resizeTimer = setTimeout(() => {
                const navbarExpanded = window.innerWidth >= XL_SCREEN_SIZE;

                // Close navbar if it was open on small screen and user resized to large screen
                if (navbarExpanded && DOM.navbarCollapse.classList.contains('show')) {
                    onNavbarHidden();

                    // Disable transition and close navbar
                    DOM.navbarCollapse.style.transition = 'none';
                    closeNavbar();
                    DOM.navbarCollapse.style.transition = '';
                }
            }, DEBOUNCE_DELAY);
        });
    };

    trackWindowResize();
    DOM.navbarCollapse.addEventListener('shown.bs.collapse', onNavbarShown);
    DOM.navbarCollapse.addEventListener('hidden.bs.collapse', onNavbarHidden);
}

/**
 * Updates navbar visibility and layout.
 */
export const updateNavbar = () => {
    if (!DOM.mainNavLinks) return;

    const isAuth = State.userIsAuthenticated;

    DOM.mainNavLinks.classList.toggle('hidden', !isAuth);
    DOM.userMenu.classList.toggle('hidden', !isAuth);
    DOM.logoutBtn.classList.toggle('hidden', !isAuth);
    DOM.loginBtn.classList.toggle('hidden', isAuth);
    DOM.registerBtn.classList.toggle('hidden', isAuth);

    // + new post container
    DOM.newPostRow?.classList.toggle('hidden', !isAuth);

    if (isAuth) {
        // Display user data on the navbar
        DOM.navbarUsername.textContent = State.currentUsername || 'User';
        DOM.navbarProfilePicture.src = State.currentUserProfilePicture ? State.currentUserProfilePicture : window.getDefaultProfilePicture();

        // Highlight active filter
        DOM.allPostsBtn.classList.toggle('active', State.currentFilter === FILTERS.ALL);
        DOM.followingBtn.classList.toggle('active', State.currentFilter === FILTERS.FOLLOWING);
    }
}

export const Header = {
    init,
    updateNavbar
};

