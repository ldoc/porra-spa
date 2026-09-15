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

  const ADMIN_SHOW_GUESTS_KEY = 'porra_admin_show_guests';

  function adminShowsGuests() {
    try { return localStorage.getItem(ADMIN_SHOW_GUESTS_KEY) === 'true'; } catch (e) { return false; }
  }

  function setAdminShowsGuests(value) {
    try { localStorage.setItem(ADMIN_SHOW_GUESTS_KEY, value ? 'true' : 'false'); } catch (e) {}
  }

  function hideGuestsForViewer(user) {
    return user?.isAdmin === true && !adminShowsGuests();
  }

  const api = { isGuestUser, isFrozenForUser, shouldShowConfirmForUser, guestBadgeHtml, adminShowsGuests, setAdminShowsGuests, hideGuestsForViewer };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.porraGuest = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
