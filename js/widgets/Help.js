/**
 * Help.js
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
 * Widget to convert elements to popup-helptexts.
 *
 * @param options
 */
SA.Help = function(options) {
	if (!options || !options.selector) {
		return;
	}

	this.selector = options.selector;
	this.elements = $(options.selector);

	if (options.help) {
		this.help = options.help;
	}
	if (options.icon) {
		this.icon = options.icon;
	}

	if (this.elements.size == 0) {
		SA.Log.w('No help elements found for selector ' + this.selector);
		return;
	}

	this.elements.each(function(i, el) {
		var helptext = $(el);
		if (helptext.html() == '') {
			return;
		}

		var wrapper = $('<'+helptext.prop('tagName')+'>').addClass(this.help);
		helptext.removeClass(this.help).wrap(wrapper);

		var icon = $('<i>').addClass(this.icon);
		wrapper.prepend(icon);

		var row = wrapper.parents('div.row');
		var parent = $(wrapper.parents('div.container').get(0));

		row.on({
			'mouseover': function() {
				if (!parent.hasClass('disabled')) {
					icon.css('visibility', 'visible');
				}
			},
			'mouseout': function() {
				icon.css('visibility', null);
			},
		});

		if (helptext.html() == '') {
			icon.remove();
		} else {
			icon.on('mousedown', function(event) {
				this.showHelp(helptext);
				return false;
			}.bind(this));
		}
	}.bind(this));

	$(document).on('mousedown', function(event) {
		if (this.open && !$(event.target).parents('div.help').length) {
			this._hide(this.open);
		}
	}.bind(this));
};

SA.Help.prototype.selector = null;
SA.Help.prototype.elements = null;
SA.Help.prototype.open = null;

SA.Help.prototype.icon = 'fa fa-question-circle';
SA.Help.prototype.help = 'help';

SA.Help.prototype.showHelp = function(el) {
	// click on open help == toggle
	if (el.data('open')) {
		this._hide(el);

	// close another element
	} else if (this.open) {
		this._hide(this.open, function() {
			this._show(el);
		});

	// just open
	} else {
		this._show(el);
	}
};

SA.Help.prototype._show = function(el) {
	el.show();
	var height = el.height();
	el.css('height', '0px');

	el.animate({
		height: height
	}, {
		duration: 200,
		complete: function() {
			el.data('open', true);
			this.open = el;
		}.bind(this)
	});
};

SA.Help.prototype._hide = function(el, callback) {
	el.data('open', null);
	this.open = null;

	el.animate({
		height: 0
	}, {
		duration: 200,
		complete: function() {
			el.hide();
			el.css('height', null);
			if (callback) {
				callback.call(this);
			}
		}.bind(this)
	});
};


})(Zepto);