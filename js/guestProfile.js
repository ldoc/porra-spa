(function (global) {
  function isGuestUser(user) {
    return user?.isGuest === true;
  }

  function isFrozenForUser(frozen, user) {
    return frozen === true && !isGuestUser(user);
  }

  function shouldShowConfirmForUser(user) {
    return !isGuestUser(user);
  }

  function guestBadgeHtml(isGuest) {
    return isGuest === true ? ' <span class="guest-tag" title="Invitado">INV</span>' : '';
  }

  const api = { isGuestUser, isFrozenForUser, shouldShowConfirmForUser, guestBadgeHtml };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.porraGuest = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
