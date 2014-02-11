/**
 * Content script.
 *
 * Controls the infobar for the current tab.
 *
 * Copyright © 2014 Alexander Hofbauer <alex@derhofbauer.at>
 *
 * This file is part of SurfAlyze.
 *
 * SurfAlyze is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * You should have received a copy of the GNU General Public License
 * along with this extension in the root folder called "LICENSE".
 * If not, see <http://www.gnu.org/licenses/>.
 */
(function() { return {

	_toolbar: null,
	_showToolbar: true,

	init: function() {
		SA.messaging.get('status', function(response) {
			if (response && response.status != 'off') {
				SA.Log.d('Enabling content script infobar');
				this._init();
			}
		}.bind(this));
	},

	_init: function() {
		this._toolbar = new SA.Infoframe(
				chrome.extension.getURL('pages/infobar.html'));
		this._toolbar.appendToDocument();

		// subscriber for infoframe tab-events
		SA.messaging.subscribe('infoframe-content', function(message) {
			// message.value contains the size of the toolbar
			if (!message.value) {
				return;
			}
			this._toolbar.setHeight(message.value);

			if (this._showToolbar) {
				this._toolbar.show();
			}
		}.bind(this));

		// subscriber for infoframe tab-events
		SA.messaging.subscribe('infoframe', function(message) {
			if (message.value == 'show') {
				this._toolbar.show();
			} else {
				this._toolbar.hide();
			}
		}.bind(this));

		// setting for showing toolbar automatically
		SA.messaging.subscribe('showtoolbar',
				this.onShowToolbarReceive.bind(this),
				this.onShowToolbarReceive.bind(this));
	},

	onShowToolbarReceive: function(message) {
		if (message) {
			this._showToolbar = message.showtoolbar;
		}
	}

}; })().init();