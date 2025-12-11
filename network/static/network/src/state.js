// state.js

export const State = {
    userIsAuthenticated: false,
    currentUsername: null,
    currentUserId: null,
    currentUserProfilePicture: null,
    currentFilter: 'all',
    viewProfileUserId: null,
    dropdownLock: true,
    showMessage: false,
    postsCount: 0,
    postsLoading: false,
    hasNextPost: true,
    scrollObserver: null,
    darkTheme: localStorage.getItem('isDark') === 'true'
};

if (window.NETWORK_INITIAL_STATE) {
    try {
        if (window.NETWORK_INITIAL_STATE) {
            Object.assign(State, window.NETWORK_INITIAL_STATE);
            delete window.NETWORK_INITIAL_STATE;
        }
    } catch (error) {
        console.error('Failed to initialize State from Django:', error);
    }
}