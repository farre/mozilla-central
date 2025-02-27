# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

let TrackingProtection = {
  PREF_ENABLED_GLOBALLY: "privacy.trackingprotection.enabled",
  PREF_ENABLED_IN_PRIVATE_WINDOWS: "privacy.trackingprotection.pbmode.enabled",
  enabledGlobally: false,
  enabledInPrivateWindows: false,

  init() {
    let $ = selector => document.querySelector(selector);
    this.container = $("#tracking-protection-container");
    this.content = $("#tracking-protection-content");
    this.icon = $("#tracking-protection-icon");

    this.updateEnabled();
    Services.prefs.addObserver(this.PREF_ENABLED_GLOBALLY, this, false);
    Services.prefs.addObserver(this.PREF_ENABLED_IN_PRIVATE_WINDOWS, this, false);

    this.enabledHistogram.add(this.enabledGlobally);
  },

  uninit() {
    Services.prefs.removeObserver(this.PREF_ENABLED_GLOBALLY, this);
    Services.prefs.removeObserver(this.PREF_ENABLED_IN_PRIVATE_WINDOWS, this);
  },

  observe() {
    this.updateEnabled();
  },

  get enabled() {
    return this.enabledGlobally ||
           (this.enabledInPrivateWindows &&
            PrivateBrowsingUtils.isWindowPrivate(window));
  },

  updateEnabled() {
    this.enabledGlobally =
      Services.prefs.getBoolPref(this.PREF_ENABLED_GLOBALLY);
    this.enabledInPrivateWindows =
      Services.prefs.getBoolPref(this.PREF_ENABLED_IN_PRIVATE_WINDOWS);
    this.container.hidden = !this.enabled;
  },

  get enabledHistogram() {
    return Services.telemetry.getHistogramById("TRACKING_PROTECTION_ENABLED");
  },

  get eventsHistogram() {
    return Services.telemetry.getHistogramById("TRACKING_PROTECTION_EVENTS");
  },

  onSecurityChange(state) {
    if (!this.enabled) {
      return;
    }

    let {
      STATE_BLOCKED_TRACKING_CONTENT, STATE_LOADED_TRACKING_CONTENT
    } = Ci.nsIWebProgressListener;

    for (let element of [this.icon, this.content]) {
      if (state & STATE_BLOCKED_TRACKING_CONTENT) {
        element.setAttribute("state", "blocked-tracking-content");
      } else if (state & STATE_LOADED_TRACKING_CONTENT) {
        element.setAttribute("state", "loaded-tracking-content");
      } else {
        element.removeAttribute("state");
      }
    }

    // Telemetry for state change.
    this.eventsHistogram.add(0);
  },

  disableForCurrentPage() {
    // Convert document URI into the format used by
    // nsChannelClassifier::ShouldEnableTrackingProtection.
    // Any scheme turned into https is correct.
    let normalizedUrl = Services.io.newURI(
      "https://" + gBrowser.selectedBrowser.currentURI.hostPort,
      null, null);

    // Add the current host in the 'trackingprotection' consumer of
    // the permission manager using a normalized URI. This effectively
    // places this host on the tracking protection allowlist.
    Services.perms.add(normalizedUrl,
      "trackingprotection", Services.perms.ALLOW_ACTION);

    // Telemetry for disable protection.
    this.eventsHistogram.add(1);

    BrowserReload();
  },

  enableForCurrentPage() {
    // Remove the current host from the 'trackingprotection' consumer
    // of the permission manager. This effectively removes this host
    // from the tracking protection allowlist.
    let normalizedUrl = Services.io.newURI(
      "https://" + gBrowser.selectedBrowser.currentURI.hostPort,
      null, null);

    Services.perms.remove(normalizedUrl,
      "trackingprotection");

    // Telemetry for enable protection.
    this.eventsHistogram.add(2);

    BrowserReload();
  },
};
