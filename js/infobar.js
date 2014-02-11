/**
 * JS for the infobar page.
 *
 * Shows details about the current tab.
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

	_contents: {},
	_contentsList: null,

	init: function() {
		SA.messaging.subscribe('blocked',
				this.onBlockedReceive.bind(this),
				this.onBlockedResponse.bind(this));

		$(document).ready(this._domReady.bind(this));
	},

	_domReady: function() {
		SA.messaging.get('status', this._statusCallback.bind(this));
		SA.I18n.translate();
		this._contentsList = $('#contentslist');
		this.buildList();

		$('#buttonhide').on('click', function() {
			SA.messaging.publish('infoframe', 'hide');
		}.bind(this));
	},

	_statusCallback: function(response) {
		var unknown = $('#unknowntitle').hide();
		var blocked = $('#blockedtitle').hide();
		if (response.status == 'warning') {
			unknown.show();
		} else if (response.status == 'armed') {
			blocked.show();
		}
	},

	/**
	 * Handler for the response to a register call on "blocked".
	 *
	 * @param response
	 */
	onBlockedResponse: function(response) {
		if (response && Object.keys(response).length) {
			for (var url in response) {
				this._addContent(url, response[url]);
			}
			this.buildList();
			this._sendReadyMessage();
		}
	},

	/**
	 * Handler for received messages of type "blocked".
	 *
	 * @param message
	 */
	onBlockedReceive: function(message) {
		var msg = message.value;
		if (!msg || !msg.url || !msg.content) {
			SA.Log.d('Invalid message reveiced for "blocked": ', message);
			return;
		}

		this._addContent(msg.url, msg.content);
		this.buildList();
		this._sendReadyMessage();
	},


	/**
	 * Builds the content list.
	 */
	buildList: function() {
		if (!this._contentsList || !this._contentsList.length) {
			return;
		}

		for (var id in this._contents) {
			var content = this._contents[id];
			if ($('#row-request-' + content.id).length) {
				continue;
			}

			var row = this._makeContentRow(content);
			this._contentsList.append(row);
		}
	},

	/**
	 * Adds a content entry.
	 *
	 * @param url
	 * @param request
	 */
	_addContent: function(url, request) {
		var content = {
			id: request.id,
			url: url,
			type: request.type,
			timeStamp: request.timeStamp
		};
		this._contents[request.id] = content;
	},

	/**
	 * Returns a row element for a content object.
	 *
	 * @param content
	 */
	_makeContentRow: function(content) {
		var Utils = SA.Utils;
		var url = Utils.sanitizeUrl(content.url);
		url = Utils.breakAt(80, url, '<br>', 10);

		var row = $('<tr>')
			.attr('id', 'row-request-' + content.id)
			.append($('<td>').addClass('bl bb').html(Utils.getDomain(content.url)))
			.append($('<td>').addClass('bb').html(content.type))
			.append($('<td>').addClass('bb').html(Utils.formatTimestamp('H:i:s', content.timeStamp)))
			.append($('<td>').addClass('br bb').html(url));
		return row;
	},

	/**
	 * Sends a ready message back to the parent tab
	 */
	_sendReadyMessage: function() {
		//height is hardcoded for now
		var height = 292;
		SA.messaging.publish('infoframe-content', height);
	}

}; })(Zepto).init();