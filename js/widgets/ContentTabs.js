/**
 * UI content tabs.
 *
 * Implements basic tabs functionality.
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
 * Widget to convert content tabs to
 */
SA.ContentTabs = function(selector) {
	if (!selector || !selector.length) {
		return;
	}

	this.tabs = [];

	selector.each(function(i, el) {
		this._initTab($(el));
	}.bind(this));
};

/**
 * Object holding all tabs.
 */
SA.ContentTabs.prototype.tabs = null;
/**
 * Pointer to the currently active tab.
 */
SA.ContentTabs.prototype.active = null;
/**
 * Tab id counter.
 */
SA.ContentTabs.prototype._idCount = 0;


/**
 * Initializes a tab element with pointers to its content.
 *
 * @param tab element
 */
SA.ContentTabs.prototype._initTab = function(tab) {
	var id = this.tabs.length;
	tab.data('id', id);

	if (tab.hasClass('active')) {
		this.active = tab;
	}

	var content = $('#' + tab.attr('id') + '-content');
	if (!content.length) {
		SA.Log.w('Could not find content for tab', tab);
		return;
	}

	this.tabs.push(content);

	tab.on({
		'click': this.click.bind(this),
		'_show': this.show.bind(this),
		'_hide': this.hide.bind(this),
	});
};

/**
 * Click event for tabs.
 *
 * @param event
 */
SA.ContentTabs.prototype.click = function(event) {
	if (this.active && this.active.length
			&& this.active[0] == event.target) {
		return;
	}

	var el = $(event.target);

	if (this.active && this.active.length) {
		this.active.trigger('_hide');
	}

	el.trigger('_show');
	this.active = el;
};

/**
 * Show event for tab content.
 *
 * @param event
 */
SA.ContentTabs.prototype.show = function(event) {
	var el = $(event.target);
	el.addClass('active');
	var content = this.tabs[el.data('id')];

	if (!content || !content.length) {
		return;
	}

	content.css('display', 'block');
	el.trigger('showtab', event);
};

/**
 * Hide event for tab content.
 *
 * @param event
 */
SA.ContentTabs.prototype.hide = function(event) {
	var el = $(event.target);
	el.removeClass('active');
	var content = this.tabs[el.data('id')];

	if (!content || !content.length) {
		return;
	}

	content.css('display', 'none');
	el.trigger('hidetab', event);
};


})(Zepto);