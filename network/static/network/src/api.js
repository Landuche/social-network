/**
 * api.js
 * Centralized API layer for all network requests.
 * - Defines route endpoints
 * - Provides wrapper functions for each type of request
 * - Uses fetchHandler() to apply common logic (headers, csrf, error handling)
 */

import { getCookie } from './utils.js';

/**
 * API endpoints
 * - These functions return the URL string for each API call
 */
const Routes = Object.freeze({
    editPost: (postId) => `/post/${postId}`,
    followUser: (userId) => `/follow/${userId}`,
    likePost: (postId) => `/post/${postId}`,
    deletePost: (postId) => `/post/${postId}`,
    fetchProfile: (userId) => `/profile/${userId}`,
    getUserEmail: (userId) => `/user/${userId}/email`,
    createComment: (postId) => `/post/${postId}/comment`,
    fetchComments: (postId) => `/post/${postId}/comments`,
    editComment: (commentId) => `/post/comment/${commentId}`,
    deleteComment: (commentId) => `/post/comment/${commentId}`,
    editProfile: () => `/profile/edit`,
    register: () => '/register',
    login: () => '/login',
    createPost: `/post`,
    logout: () => '/logout'
});

/**
 * Handles all API requests with fetch.
 * - Automatically attaches CSRF token for unsafe HTTP methods
 * - Stringifies body and adds headers/CSRF if payload is provided
 * - Attempt to parse JSON
 * - Return data to caller
 * - On error: throws with API error message or HTTP status
 * @param {string} url - Endpoint to call
 * @param {string} [method="GET"] - HTTP method
 * @param {Object|null} [body=null] - Data to send (will be JSON.stringified)
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If response not ok or fetch fails
 */
async function fetchHandler(url, method = 'GET', body = null) {
    const options = { method, headers: {} };

    // Include csrf token when necessary
    if (['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
        options.headers['X-CSRFToken'] = getCookie('csrftoken');
    }

    if (body) {
        if (body instanceof FormData) {
            options.body = body;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMessage = data.error || `HTTP Error status: ${response.status}`;
        throw new Error(errorMessage);
    }

    return data;
};

/**
 * API methods
 * - Small wrappers around fetchHandler with the correct route & payload
 */
export const API = {
    editComment: async (commentId, content) => fetchHandler(Routes.editComment(commentId), 'PUT', { action: 'edit', content }),
    deleteComment: async (commentId) => fetchHandler(Routes.deleteComment(commentId), 'DELETE', { action: 'delete' }),
    editPost: async (postId, content) => fetchHandler(Routes.editPost(postId), 'PUT', { action: 'edit', content }),
    likePost: async (postId) => fetchHandler(Routes.likePost(postId), 'PUT', { action: 'like' }),
    createPost: async (content) => fetchHandler(Routes.createPost, 'POST', { content }),
    editProfile: async (formData) => fetchHandler(Routes.editProfile(), 'POST', formData),
    register: async (formData) => fetchHandler(Routes.register(), 'POST', formData),
    login: async (formData) => fetchHandler(Routes.login(), 'POST', formData),
    fetchProfile: async (userId) => fetchHandler(Routes.fetchProfile(userId)),
    fetchComments: async (postId) => fetchHandler(Routes.fetchComments(postId)),
    createComment: async (postId, content) => fetchHandler(Routes.createComment(postId), 'POST', { content }),
    followUser: async (userId) => fetchHandler(Routes.followUser(userId), 'PUT'),
    deletePost: async (postId) => fetchHandler(Routes.deletePost(postId), 'DELETE', { action: 'delete' }),
    getUserEmail: async (userId) => fetchHandler(Routes.getUserEmail(userId)),
    logout: async () => fetchHandler(Routes.logout()),

    /**
     * Fetch posts (url generated dynamically in loadPosts)
     * @param {string} url - API endpoint including additional params
     */
    fetchPosts: async (url) => fetchHandler(url),
    getMorePosts: async (url) => fetchHandler(url)
};