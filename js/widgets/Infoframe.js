/**
 * Infobar injecting an iframe into webpages.
 * Should be run in webpage / DOM context to allow $() to access the document.
 *
 * Used to display status messages to users.
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

(function($) {

/**
 * Element showing a URL inside an iframe.
 *
 * @param url URL of the page to load
 * @param document Element to append iframe to (default: 'html')
 */
SA.Infoframe = function(url, document) {
	if (!url) {
		return;
	}

	this.url = url;
	this.document = document || 'html';
	this.id = chrome.i18n.getMessage("@@extension_id");

	this.layer = $('<div>')
		.attr('id', this.id + '-infoframe')
		.css(this.layerStyle);

	this.bg = $('<div>')
		.css(this.bgStyle)
		.appendTo(this.layer);

	this.iframe = $('<iframe>')
		.attr('id', this.id + '-iframe')
		.attr('src', this.url)
		.css(this.iframeStyle)
		.appendTo(this.layer);

	this._events = {
		'mousewheel': this._scrollwheelHandler.bind(this)
	};
};

SA.Infoframe.prototype.url = null;
SA.Infoframe.prototype.document = null;
SA.Infoframe.prototype.id = null;

SA.Infoframe.prototype.layer = null;
SA.Infoframe.prototype.bg = null;
SA.Infoframe.prototype.iframe = null;

SA.Infoframe.prototype._events = null;
SA.Infoframe.prototype._height = null;
SA.Infoframe.prototype._visible = false;

SA.Infoframe.prototype.layerStyle = {
	'position': 'fixed',
	'top': '0',
	'left': '0',
	'width': '100%',
	'height': '100vh',
	'background-color': 'transparent',
	'z-index': '1000000000',
	'overflow': 'hidden',
	'opacity': '1',
	'display': 'none'
};

SA.Infoframe.prototype.bgStyle = {
	'position': 'absolute',
	'top': '0',
	'left': '0',
	'width': '100%',
	'height': '100%',
	'overflow': 'hidden',
	'z-index': '0',
	'background-color': 'black',
	'opacity': '0.7'
};

SA.Infoframe.prototype.iframeStyle = {
	'position': 'absolute',
	'top': '0',
	'left': '0',
	'width': '100%',
	'height': '0',
	'overflow': 'hidden',
	'z-index': '1',
	'padding': '0',
	'margin': '0',
	'background-color': 'white',
	'box-shadow': '0 5px 15px 2px #888888',
	'border': 'none',
	'border-bottom': '2px solid white'
};


/**
 * Appends the infobar to its document.
 */
SA.Infoframe.prototype.appendToDocument = function() {
	$(this.document).append(this.layer);
};

/**
 * @param event
 */
SA.Infoframe.prototype._scrollwheelHandler = function(event) {
	return false;
};

/**
 * Sets the infobar visible, adds specific events.
 */
SA.Infoframe.prototype.show = function() {
	if (this._visible) {
		return;
	}

	this.layer.css(this.layerStyle);
	this.layer.css('display', 'block');

	if (this._height) {
		$(window).on(this._events);
		$(document).on(this._events);
		this.iframe.on(this._events);

		this._animateIn();
		this._visible = true;
	}
};

/**
 * Sets the infobar invisible, removes all events.
 */
SA.Infoframe.prototype.hide = function() {
	this.iframe.animate({top: -this._height}, 150, 'ease-in');

	this.layer.animate({opacity: 0}, {
		duration: 150,
		type: 'ease-in',
		complete: function() {
			this.layer.css('display', 'none');
		}.bind(this)
	});

	$(window).off(this._events);
	$(document).off(this._events);
	this.iframe.off(this._events);

	this._visible = false;
};

/**
 * Sets the height of the iframe.
 * @param height
 */
SA.Infoframe.prototype.setHeight = function(height) {
	this.iframe.css('height', height + 'px');
	this._height = height;
};

/**
 * Animates the iframe in
 */
SA.Infoframe.prototype._animateIn = function() {
	this.iframe.css('top', (-this._height) + 'px');
	this.iframe.animate({top: 0}, {
		duration: 300,
		type: 'ease-out',
		complete: function() {
			this.iframe.focus();
		}.bind(this)
	});
};


})(Zepto);