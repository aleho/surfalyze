/**
 * Storage implementation.
 *
 * Initializes database schema and provides a simple O/R access to tables via
 * local objects.
 *
 * @example <caption>Example initialization of Storage:</caption>
 * var db = new SA.Storage({
 *     db: {
 *         id: 'database',
 *         name: 'Database',
 *         size: 5 * 1024 * 1024, // 5 MB
 *         schema: [
 *             users: [
 *                 "`id` INTEGER PRIMARY KEY",
 *                 "`group_id` INTEGER NOT NULL",
 *                 "`email` TEXT NOT NULL UNIQUE"
 *             ]
 *         ]
 *     },
 *
 *     error: function(db, error) {
 *         console.log('Could not initialize Storage', error);
 *     },
 *
 *     ready: function(db, data, event) {
 *         SA.doSomeOperationsOnDatabase(db);
 *     }
 * });
 *
 * @example <caption>Example queries</caption>
 * db.users.associate(true).findArray(function(err, users) {
 *     // users will be an associative array of user.id => user
 * });
 *
 * db.users.cols(['email', 'group_id']).findList(function(err, users) {
 *     // users will be an object of email => group_id
 * });
 *
 * // find a list of users and their group names indexed by user.id
 * db.users
 *     .cols(['id', 'email', 'group.id', 'group.name'])
 *     .join('groups', {group_id: 'id'})
 *     .associate(true)
 *     .findArray(...);
 *
 * @example <caption>Advanced insert query using an ID from a join table</caption>
 * db.query(
 *     {
 *         q: "INSERT INTO `users` (`group_id`, `email`) VALUES (?, (SELECT `id` FROM `groups` WHERE `name` = ?), ?)",
 *         v: ['admins', 'user@domain.com']
 *     },
 *     function(err, result) {
 *         if (err || !result.insertId) {
 *             console.log('Could not insert a user record');
 *             return;
 *         }
 *         console.log(result);
 *     }
 * );
 *
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

/**
 * @param options See SA.dbOptions.
 */
SA.Storage = function(options) {
	options.db = options.db || SA.dbOptions;

	this._db = new SA.SQLiteDb();
	this.query = this._db.query.bind(this._db);

	if (options.ready) {
		this._db.on('ready', options.ready);
	}
	if (options.error) {
		this._db.on('error', options.error);
	}

	this._db.init(options.db);

	if (!options.db.schema) {
		return;
	}

	// set all table names as properties
	for (var table in options.db.schema.tables) {
		this[table] = new SA.Storage.Table(table, this._db);
	}
};


/**
 * The SQLite DB implementation (WebSQL).
 */
SA.Storage.prototype._db = null;

/**
 * Just a shortcut to query in SQLiteDb.js.
 */
SA.Storage.prototype.query = null;

/**
 * Just a shortcut to "on" event binding in DB layer.
 *
 * @param event
 * @param callback
 * @return {this}
 */
SA.Storage.prototype.on = function(event, callback) {
	this._db.on(event, callback);
	return this;
};


/**
 * Implements a chainable table access object.
 *
 * @param name Table name
 * @param db DB layer object
 */
SA.Storage.Table = function(name, db) {
	this._db = db;
	this.name = name;
	this._reset();
};

/**
 * Name of this table.
 */
SA.Storage.Table.prototype.name = null;
/**
 * DB object to perform queries.
 */
SA.Storage.Table.prototype._db = null;
/**
 * Object of arguments (initialized by calling _reset())
 */
SA.Storage.Table.prototype._args = null;


/**
 * Inserts a row into this table.
 *
 * @param row
 * @param options
 * @param callback
 */
SA.Storage.Table.prototype.insert = function(row, options, callback) {
	this._reset();
	this._db.insert(this.name, row, options, callback);
};

/**
 * Inserts all passed rows into this table.
 *
 * @param rows
 * @param options
 * @param callback
 */
SA.Storage.Table.prototype.insertAll = function(rows, options, callback) {
	this._reset();
	this._db.insertAll(this.name, rows, options, callback);
};

/**
 * Executes an update statement.
 *
 * @param condition
 * @param values
 * @param callback
 */
SA.Storage.Table.prototype.update = function(condition, values, callback) {
	this._reset();
	this._db.update(this.name, condition, values, callback);
};

/**
 * Executes a delete statement defined by the passed document.
 *
 * @param document
 * @param callback
 */
SA.Storage.Table.prototype.remove = function(document, callback) {
	this._reset();
	this._db.remove(this.name, document, callback);
};


/**
 * Retrieves the result of a select statement.
 * The data returned is a raw result as returned by the DB layer.
 *
 * @param document
 * @param callback
 */
SA.Storage.Table.prototype.find = function(document, callback) {
	var args = this._prepareArguments();
	this._reset();
	this._db.find(args, document, callback);
};

/**
 * Retrieves an array of the result of a select statement.
 * The data returned is an array containing all the rows as retrieved by the DB.
 *
 * @param document
 * @param callback
 */
SA.Storage.Table.prototype.findArray = function(document, callback) {
	var args = this._prepareArguments();
	this._reset();
	this._db.findArray(args, document, callback);
};

/**
 * Retrieves an object of the result of a select statement.
 * The data returned is indexed by the first column passed to the columns()
 * function.
 *
 * @param document
 * @param callback
 */
SA.Storage.Table.prototype.findList = function(document, callback) {
	var key = this._args.columns[0];
	var cols = this._args.columns.slice(1);
	var args = this._prepareArguments();
	this._reset();
	this._db.findList(args, key, cols, document, callback);
};

/**
 * Returns the first item returned by a select statement.
 *
 * @param document
 * @param callback
 */
SA.Storage.Table.prototype.findFirst = function(document, callback) {
	var args = this._prepareArguments();
	this._reset();
	this._db.findFirst(args, document, callback);
};


/**
 * Prepares all query parameters of this table to be passed to the DB layer.
 *
 * @return {Object}
 */
SA.Storage.Table.prototype._prepareArguments = function() {
	return {
		table: this.name,
		columns: this._args.columns,
		joins: this._args.joins,
		order: this._args.order,
		group: this._args.group,
		perId: this._args.perId
	};
};

/**
 * Resets all temporary table setup variables (joins, columns, order, etc.),
 *
 * @return {this}
 */
SA.Storage.Table.prototype._reset = function() {
	this._args = {
		columns: null,
		joins: null,
		order: null,
		group: null,
		perId: false
	};
	return this;
};


/**
* Sets the columns to retrieve.
*
* @param columns Array of columns
* @return {this}
*/
SA.Storage.Table.prototype.cols = function(columns) {
	this._args.columns = columns;
	return this;
};

/**
 * Sets the tables to join with and join conditions.
 *
 * @param table Table name
 * @param on Join conditions
 * @param type Join type
 * @return {this}
 */
SA.Storage.Table.prototype.join = function(table, on, type) {
	if (!this._args.joins) {
		this._args.joins = [];
	}
	this._args.joins.push({table: table, type: type, on: on});
	return this;
};

/**
 * Enables or disables the natural association logic for findArray.
 *
 * Retrieved arrays will be associated by either 'id' or '_id', if
 * applicable for this table.
 *
 * @param enable Whether to enable association
 * @return {this}
 */
SA.Storage.Table.prototype.associate = function(enable) {
	this._args.perId = enable;
	return this;
};

/**
 * Adds a group by statement.
 *
 * @param statement
 * @return {this}
 */
SA.Storage.Table.prototype.group = function(statement) {
	if (!this._args.group) {
		this._args.group = [];
	}
	this._args.group.push(statement);
	return this;
};

/**
 * Adds an order by statement.
 *
 * @param statement
 * @return {this}
 */
SA.Storage.Table.prototype.order = function(statement) {
	if (!this._args.order) {
		this._args.order = [];
	}
	this._args.order.push(statement);
	return this;
};