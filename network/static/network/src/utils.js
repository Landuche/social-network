/**
 * utils.js
 * General-purpose utility functions used across the app.
 * - Handles DOM manipulation, timing, authentication, and formatting
 * - Provides reusable helper functions for other modules
 */

import { State } from './state.js';
import { MESSAGES } from './constants.js';
import { MAX_IMAGE_SIZE } from './constants.js';
import { ProfileUtils } from './profile.js';

/**
 * Executes a callback when the user clicks outside a specified element.
 * - Attaches a one-time click listener to the document
 * - Call callback if the click is outside the target element or on an element with the specified class
 * @param {HTMLElement} element - Element to monitor for outside clicks
 * @param {Function} callback - Function to run when an outside click occurs
 * @param {string|null} [elClass=null] - Optional class to trigger callback if clicked
 */
export const handleOutsideClick = (element, callback, elClass = null) => {
    if (!element || !callback) return;

    const handler = async (event) => {
        const outsideClick = !element.contains(event.target);
        const elClick = elClass && event.target.closest(`.${elClass}`);
        if (outsideClick || elClick) {
            // Remove listener before calling back
            document.removeEventListener('click', handler);
            await callback();
        }
    };

    // Use a regular listener and remove it inside the handler
    document.addEventListener('click', handler, { once: true });
};

/**
 * Format a timestamp to a readable string.
 * @param {string} timestamp - Timestamp to format
 * @returns {string} Formatted date string 
 */
export const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Invalid date";

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Invalid date";

    const options = {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };

    return date.toLocaleString(undefined, options);
};

/**
 * Get a cookie value by name.
 * @param {string} name - Name of the cookie
 * @returns {string|null} Cookie value or null if not found
 */
export const getCookie = (name) => {
    if (!name) return null;

    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.slice(name.length + 1));
                break;
            };
        };
    };
    return cookieValue;
};

/**
 * Validate that provided arguments are not null or undefined.
 * @param {Object} args - Key-value pairs of arguments to check
 * @param {string} fnName - Function name for console error messages
 * @returns {boolean} True if all arguments are valid
 */
export const checkArgs = (args, fnName) => {
    for (const [key, value] of Object.entries(args)) {
        if (value === null || value === undefined) {
            console.error(`${fnName}: Invalid arguments: key -> ${key}, value ->`, value);
            return false;
        }
    }
    return true;
};

/**
 * Await next animation frame.
 * @returns {Promise} Resolves on next frame
 */
export const awaitFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

/**
 * Wait for a specified number of milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Resolves after timeout
 */
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clear all child nodes from an element.
 * @param {HTMLElement} element - Element to clear
 */
export const clearElement = (element) => {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
};

/**
 * Check if the user is authenticated.
 * - Redirects to login page if not
 * @returns {boolean} True if authenticated, false if not
 */
export const checkUserAuth = () => {
    if (!State.userIsAuthenticated) {
        ProfileUtils.showAuthModal(null, 'login');
        return false;
    }
    return true;
};

/**
 * Scroll window to top smoothly if scrolled more than 10px.
 */
export const scrollTop = () => {
    return new Promise(resolve => {
        if (window.scrollY < 10) {
            return resolve();
        }
        const scrollHandler = () => {
            if (window.scrollY < 10) {
                window.removeEventListener('scroll', scrollHandler);
                resolve();
            }
        };

        window.addEventListener('scroll', scrollHandler);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            if (window.scrollY < 10) {
                window.removeEventListener('scroll', scrollHandler);
                resolve();
            }
        }, 1000);
    });
};

/**
 * Validate email format.
 * - Uses regex to check if email follows standard pattern
 * @param {string} email - Email to validate
 * @returns {Object} Validation result { error: boolean, message: string|null }
 */
export const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const regexTest = regex.test(email);
    return regexTest
        ? { error: false, message: null }
        : { error: true, message: MESSAGES.profile.errors.ui.INVALID_EMAIL };
};

/**
 * Validate username constraints.
 * - Must be between 3 and 50 characters
 * - Cannot be empty
 * @param {string} username - Username to validate
 * @returns {Object} Validation result { error: boolean, message: string|null }
 */
export const validateUsername = (username) => {
    if (!username || username.length > 50 || username.length < 3) {
        return { error: true, message: MESSAGES.profile.errors.ui.USERNAME_ERROR };
    }
    return { error: false, message: null };
};

/**
 * Validate uploaded image.
 * - Checks allowed file types
 * - Enforces max file size (5 MB)
 * @param {File} image - Image file object
 * @returns {Object} Validation result { error: boolean, message: string|null }
 */
export const validateImage = (image) => {
    // Allowed types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(image.type)) {
        return { error: true, message: `Unsupported image format: ${image.type}` };
    }

    if (image.size > MAX_IMAGE_SIZE) {
        return { error: true, message: 'Image too big.' }
    }

    return { error: false, message: null };
}

/**
 * Validate password.
 * - Check for valid length
 * - Optionally, check if password matches with confirmation
 * @param {string} password 
 * @param {string} confirmation 
 * @returns {Object} Validation result { error: boolean, message: string|null }
 */
export const validatePassword = (password, confirmation) => {
    if (confirmation && password != confirmation) {
        return { error: true, message: 'Passwords must match.' };
    }

    if (password.length < 6) {
        return { error: true, message: 'Passwords must have at least 6 characters.' };
    }

    return { error: false, message: null };
}