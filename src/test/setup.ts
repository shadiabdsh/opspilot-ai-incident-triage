import '@testing-library/jest-dom/vitest';

// jsdom does not implement layout or scrolling; the trace calls these.
Element.prototype.scrollIntoView = function scrollIntoView() {};
window.scrollTo = (() => {}) as typeof window.scrollTo;
Element.prototype.scrollTo = function scrollTo() {};
