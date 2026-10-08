if (typeof window !== 'undefined' && typeof Element !== 'undefined') {
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
    if (name === 'aria-hidden' && (value === 'true' || value === true)) {
        try {
        if (this.contains && document.activeElement && this.contains(document.activeElement)) {
            if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
            document.activeElement.blur();
            }
        }
        } catch {
        /* safety guard */
        }
    }
    return originalSetAttribute.apply(this, arguments);
    };
}