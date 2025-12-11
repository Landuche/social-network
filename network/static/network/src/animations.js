/**
 * animations.js
 * Centralized way to trigger CSS animations from JavaScript.
 * - Keeps animation names consistent between JS and CSS
 * - Allows controlling duration dynamically
 * - Handles setup/cleanup automatically
 */

import { checkArgs } from './utils.js';

const Names = Object.freeze({
    fadeInExpand: 'fade-in-expand',
    fadeOutShrink: 'fade-out-shrink',
    fadeInSlideDown: 'fade-in-slide-down',
    fadeOutSlideUp: 'fade-out-slide-up',
    fadeOutCollapse: 'fade-out-collapse'
});

/**
 * Play a CSS animation on a given element.
 * - Store element size if needed
 * - Applies the animation and waits for its completion
 * - Cleans up classes and inline styles after completion
 * @param {keyof typeof Names} animationName - Must be present on App.Animations.Names
 * @param {HTMLElement} el - Target element
 * @param {number} [animationDuration=500] - Duration in ms 
 */
const play = async (animationName, el, animationDuration = 500) => {
    if (!checkArgs({ animationName, el }, 'Animations.play')) return;

    // Validate if animation exists
    if (!Object.values(Names).includes(animationName)) {
        console.error(`Animations.play: Animation not found:' ${animationName}`);
        return;
    }

    // For collapse animations, get current size
    if (animationName === Names.fadeOutCollapse) {
        const style = getComputedStyle(el)
        el.style.setProperty('--initial-height', `${el.offsetHeight}px`);
        el.style.setProperty('--initial-margin', style.margin);
        el.style.setProperty('--initial-padding', style.padding);
    }

    // Apply animation
    el.style.animationDuration = `${animationDuration}ms`;
    el.classList.add(animationName);

    // Await animation end and clean up
    await new Promise(resolve => {
        el.addEventListener('animationend', () => {
            el.classList.remove(animationName);
            el.style.removeProperty('animation-duration');

            el.style.removeProperty('--initial-height');
            el.style.removeProperty('--initial-margin');
            el.style.removeProperty('--initial-padding');
            resolve();
        }, { once: true });
    });
};

/**
 * Expands an element using CSS transitions for height.
 */
const expand = async (el) => {
    const height = el.scrollHeight + 'px';
    el.style.height = '0px'
    el.style.overflow = 'hidden';

    // Use requestAnimationFrame to ensure the transition starts from the '0px' state
    requestAnimationFrame(() => {
        el.style.height = height;
    });

    await new Promise(resolve => {
        el.addEventListener('transitionend', () => {
            el.style.height = 'auto'; // Remove explicit height after transition
            el.style.overflow = '';
            resolve();
        }, { once: true });
    });
};

/**
 * Collapses an element using CSS transitions for height.
 */
const collapse = async (el) => {
    const height = el.scrollHeight + 'px';
    el.style.height = height;

    // Use requestAnimationFrame to ensure the transition starts from the full height
    requestAnimationFrame(() => {
        el.style.height = '0px';
    });

    await new Promise(resolve => {
        el.addEventListener('transitionend', () => {
            el.classList.add('d-none');
            el.style.height = null; // Clean up inline height
            resolve();
        }, { once: true });
    });
};

export const Animations = {
    Names,
    play,
    expand,
    collapse,
};