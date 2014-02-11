/**
 * JS for the blocked page.
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

	init: function() {
		$(document).ready(this._init.bind(this));
	},

	_init: function() {
		this._address = $('#pageblocked-url');

		SA.messaging.get('blockedurl', function(response) {
			this._address.text(response);
			// replace the visible address to make sure users don't get confused
			window.history.replaceState({}, response, response);
		}.bind(this));
	}

}; })(Zepto).init();