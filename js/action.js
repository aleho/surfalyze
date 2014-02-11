/**
 * JS for the action page (SurfAlyze icon).
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
(function($) { return {

	_contentsInfo: null,
	_status: null,
	_counts: null,

	init: function() {
		$(document).ready(this._init.bind(this));
	},

	_init: function() {
		this._contentsInfo = $('#contentsinfo');
		this._status = $('span#status');
		this._counts = $('span.contentscount');

		$('a#options').attr('href', chrome.extension.getURL('pages/options.html'));
		$('#showtoolbar').on('click', this._showToolbarEvent.bind(this));
		SA.messaging.get('status', this._statusCallback.bind(this));

		this._findCurrentTab(function(tab) {
			var onBlocked = this._onBlockedEvent.bind(this);
			SA.messaging.subscribe({type: 'blocked', tabId: tab.id},
					onBlocked, onBlocked);
		}.bind(this));
	},

	_findCurrentTab: function(callback) {
		chrome.tabs.query({
		    active: true,
		    lastFocusedWindow: true
		}, function(tabs) {
			// we dont' expect more than one hit
			if (tabs.length != 1) {
				return;
			}
			callback.apply(callback, [tabs[0]]);
		});
	},

	_statusCallback: function(response) {
		this._status.html(SA.messaging.getStatusText(response.status));

		if (response.status == 'off') {
			this._contentsInfo.hide();

		} else {
			var unknown = $('#unknown').hide();
			var blocked = $('#blocked').hide();

			if (response.status == 'warning') {
				unknown.show();
			} else if (response.status == 'armed') {
				blocked.show();
			}

			this._contentsInfo.show();
		}
	},

	_showToolbarEvent: function() {
		this._findCurrentTab(function(tab) {
			SA.messaging.publish('infoframe', 'show', tab.id);
		});
	},

	_onBlockedEvent: function(response) {
		var count = null;

		if (!response || !(count = Object.keys(response).length)) {
			this._contentsInfo.hide();
		} else {
			this._contentsInfo.show();
			this._counts.html(count);
		}
	}

}; })(Zepto).init();