/**
 * app.js
 * Entry point for the Network app.
 * - Initializes DOM caches and event listeners
 * - Delegates actions to respective modules (posts, profile)
 * - Loads default posts on the index page
 */

import { State } from './state.js';
import { MESSAGES } from './constants.js';
import { Post } from './post.js';
import { PostHelpers } from './post-helpers.js';
import { ProfileUtils } from './profile.js';
import { DOMUtils, initIndex } from './dom.js';
import { Header, updateNavbar } from './header.js';


/**
 * Initialize the main app.
 * - Initializes index-specific DOM references
 * - Binds new post form listener if the user is authenticated
 * - Start intersection observer sentinel to handle infinite scroll
 * - Sets up delegated event handling for posts feed and profile
 * - Loads posts by default
 * - Handles errors globally
 * 
 * * @throws {Error} shows user-friendly message
 */
async function initApp() {
    try {
        initIndex();
        PostHelpers.bindNewPostForm();
        Post.delegate();
        ProfileUtils.delegate();
        DOMUtils.initInfiniteScroll();
        await Post.loadPosts();
    } catch (error) {
        console.error('App.init Error:', error);
        DOMUtils.displayMainMessage(MESSAGES.post.errors.ERROR_LOADING_POSTS);
    }
};


/**
 * Main app initializer on page load.
 * - Sets up header 
 * - Handles theme
 * - Calls initApp if on the index page
 */
function init() {
    Header.init();
    DOMUtils.handleTheme();
    if (document.getElementById('network-app')) initApp();
    document.body.classList.add('loaded');
};

/**
 * Wait for DOM before initializing
 */
document.addEventListener('DOMContentLoaded', init);
