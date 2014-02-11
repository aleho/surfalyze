/**
 * Implementation of DOM Storage.
 *
 * Provides a simple O/R mapper and various convenience methods.
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
 * No options here. Pass them to init() because there's the magic.
 */
SA.SQLiteDb = function() {};

/**
 * Initializes the DOM storage performing migration tasks if needed.
 */
SA.SQLiteDb.prototype.init = function(options) {
	var name = options.id;
	var version = SA.VERSION;
	var displayName = options.name;
	var size = options.size || 5 * 1024;

	var db = openDatabase(name, '', displayName, size);

	if (!db) {
		this._trigger('error', {
			msg: 'openDatabase(): Could not open WebSQL database. This should not happen.'
		});
		return;
	}

	this._db = db;
	this._schema = options.schema;

	if (!this._schema) {
		return;
	}

	// initialize schema
	if (db.version != version) {
		if (db.version == '') {
			db.changeVersion('', version, function() {
				this._initDb(function(err) {
					this._trigger('initialized');
					this._trigger('ready');
				});
			}.bind(this));

		} else {
			this._migrateDb(db.version, version, function() {
				this._trigger('migrated');
				this._trigger('ready');
			}.bind(this));
		}

	} else {
		setTimeout(function() {
			this._trigger('ready');
		}.bind(this), 0);
	}
};

SA.SQLiteDb.prototype._schema = null;
SA.SQLiteDb.prototype._db = null;
SA.SQLiteDb.prototype._debug = false;
SA.SQLiteDb.prototype._listeners = {};

/**
 * Returns a string formatted for usage as a date string in SQLite.
 * @param date
 */
SA.SQLiteDb.formatDate = function(date) {
	if (!date) {
		date = new Date();
	}
	return SA.Utils.formatTimestamp('Y-m-d H:i:s.u', date.getTime());
};

/**
 * Creates all application tables and pre-fills them according to schema.
 *
 * @param callback Callback to be run after init is completed.
 */
SA.SQLiteDb.prototype._initDb = function(callback) {
	var tablesCount = this._schema.tables.length
			? this._schema.tables.length
			: Object.keys(this._schema.tables).length;

	for (var table in this._schema.tables) {
		var realCallback = (--tablesCount == 0) ? callback : undefined;
		var rows = this._schema.tables[table];
		var columns = rows.join(', ');
		var values = this._schema.values[table];

		var create = 'CREATE TABLE IF NOT EXISTS `' + table + '` ('+ columns + ')';

		var indexes = null;
		if (this._schema.indexes[table]) {
			indexes = [];
			for (var index in this._schema.indexes[table]) {
				var tableIndex = 'CREATE INDEX `' + index + '` ON `' + table + '` ('
						+ this._schema.indexes[table][index] + ')';
				indexes.push(tableIndex);
			}
		}

		// anon function, because the parameters are changed in next iteration
		(function(table, values, indexes, realCallback) {
			this.query(create, function(err) {
				if (err) {
					return;
				}

				if (indexes && indexes.length) {
					for (var index in indexes) {
						// we don't care that much if indexes fail
						this.query(indexes[index]);
					}
				}

				if (values && values.length) {
					this.insertAll(table, values, realCallback);
				}

			}.bind(this));
		}.bind(this))(table, values, indexes, realCallback);
	};
};

/**
 * Migrates the current database.
 *
 * @param oldVersion
 * @param newVersion
 * @param callback
 */
SA.SQLiteDb.prototype._migrateDb = function(oldVersion, newVersion, callback) {
	switch (newVersion) {
		// nothing to do
		case '0.1.1':
			break;

		default:
			this._trigger('error', {msg: 'DB needs migration ('
					+ oldVersion + ' -> ' + newVersion +')'});
			return;
	}


	this._db.changeVersion(oldVersion, newVersion, function(ta) {
		console.log('migrated');
		// db migration unimplemented
		if (typeof callback == 'function') {
			callback.call(this);
		}
	});
};



/**
 * Enables SQL statement debugging.
 *
 * @param enabled
 */
SA.SQLiteDb.prototype.debugSql = function(enabled) {
	this._debug = enabled;
};


/**
 * Executes a database query.
 *
 * @param statement A query string or an object containing q/v as query and
 * values for a prepared statement (use ? as placeholder).
 *
 * @param statement
 * @param callback
 */
SA.SQLiteDb.prototype.query = function(statement, callback) {
	var values = null;
	if (typeof statement == 'object') {
		values = statement.v;
		statement = statement.q;
	}

	if (typeof statement != 'string' || !statement) {
		this._trigger('error', {msg: 'Invalid statement parameter'});
		return;
	}

	if (this._debug) {
		SA.Log.d('query(), statement: ' + statement);
		if (values) {
			SA.Log.d(values);
		}
	}

	this._db.transaction(function(ta) {
		ta.executeSql(statement, values,
			function(ta, result) {
				this._queryCallback(null, result, ta, callback);
			}.bind(this),
			function(ta, error) {
				if (error) {
					this._trigger('error', {
						msg: 'executeSQL() failed: ' + error.message,
						statement: statement,
						error: error
					});
				}

				this._queryCallback(error, null, ta, callback);

			}.bind(this));
	}.bind(this));
};

/**
 * Executes a query and returns the result as array.
 *
 * @param statement
 * @param callback
 */
SA.SQLiteDb.prototype.queryArray = function(statement, callback) {
	this.query(statement, function(err, result, ta) {
		if (err) {
			callback.apply(this, [err, null, ta]);
		} else {
			var rows = [];
			for (var i = 0; i < result.rows.length; i++) {
				var item = result.rows.item(i);
				var id = null;

				if (statement.perId && !statement.sorting) {
					if ('id' in item) {
						id = item.id;
					} else if ('_id' in item) {
						id = item._id;
					} else {
						SA.Log.e('SQLiteDb.queryArray(): Failed to find a valid column for ID, association failed');
						SA.Log.t();
					}
				}

				if (id) {
					rows[id] = item;
				} else {
					rows.push(item);
				}
			}

			callback.apply(this, [null, rows, ta]);
		}
	});
};

/**
 * Executes a query and returns the result as list.
 *
 * @param statement
 * @param callback
 */
SA.SQLiteDb.prototype.queryList = function(statement, callback) {
	if (!statement.columns || !statement.key) {
		var error = {msg: 'Missing parameters'};
		this._trigger('error', {
			msg: 'queryList() failed: Missing parameters',
			error: error
		});
		callback.apply(this, [err, null, null]);
		return false;
	}

	this.query(statement, function(err, result, ta) {
		if (err) {
			callback.apply(this, [err, null, ta]);
		} else {
			var rows = {};
			for (var i = 0; i < result.rows.length; i++) {
				var row = result.rows.item(i);
				var item;
				if (statement.columns.length == 1) {
					item = row[statement.columns[0]];
				} else {
					item = [];
					for (var i in statement.columns) {
						item.push(row[statement.columns[i]]);
					}
				}
				rows[row[statement.key]] = item;
			}
			callback.apply(this, [null, rows, ta]);
		}
	});
};

/**
 * Unified callback for queries.
 *
 * @param err
 * @param result
 * @param ta
 * @param callback
 */
SA.SQLiteDb.prototype._queryCallback = function(err, result, ta, callback) {
	if (callback) {
		callback.apply(this, [err, result, ta]);
	}
};


/**
 * Inserts a row into a table.
 *
 * @param table
 * @param row
 * @param options
 * @param callback
 */
SA.SQLiteDb.prototype.insert = function(table, row, options, callback) {
	if (!callback && typeof options == 'function') {
		callback = options;
		options = null;
	}

	var c = [];
	var v = [];
	for (var col in row) {
		c.push(col);
		v.push(row[col]);
	}

	var conflict = '';
	if (options && typeof options == 'object') {
		conflict = options.conflict ? 'OR ' + options.conflict + ' ' : '';
	}

	var columns = '(`' + c.join('`, `') + '`)';
	var placeholders = '(?' + (new Array(v.length)).join(', ?') + ')';
	this.query({
		q: 'INSERT ' + conflict + 'INTO `' + table + '` ' + columns + ' VALUES ' + placeholders,
		v: v
	}, callback);
};

/**
 * Inserts an array of objects (rows) into a table.
 *
 * Inserts via SELECT and UNION ALL, so make sure there are equals columns for every
 * row, because empty columns will be set as NULL.
 *
 * @param table
 * @param rows Array containing objects of rows to be inserted
 * @param options
 * @param callback
 */
SA.SQLiteDb.prototype.insertAll = function(table, rows, options, callback) {
	if (!callback && typeof options == 'function') {
		callback = options;
		options = null;
	}

	var conflict = '';
	if (options && typeof options == 'object') {
		conflict = options.conflict ? 'OR ' + options.conflict + ' ' : '';
	}

	// build a list of columns so we can set missing columns for union
	var columns = {};
	for (var row in rows) {
		for (var c in rows[row]) {
			columns[c] = true;
		}
	}
	columns = Object.keys(columns);

	var values = [];
	var firstRow = null;
	var unionRows = '';
	for (var r in rows) {
		for (var i in columns) {
			var c = columns[i];
			// populate values array
			values.push((rows[r][c]) ? rows[r][c] : null);
		}

		if (!firstRow) {
			firstRow = ' SELECT ? AS `' + columns.join('`, ? AS `') + '`';
		} else {
			unionRows += ' UNION ALL SELECT ?' + (new Array(columns.length)).join(', ?');
		}
	}

	columns = '(`' + columns.join('`, `') + '`)';

	this.query({
		q: 'INSERT ' + conflict + 'INTO `' + table + '` ' + columns + firstRow + unionRows,
		v: values
	}, callback);
};

/**
 * Prepares a query object for find statements.
 *
 * @param stmt
 * @param document
 */
SA.SQLiteDb.prototype._prepareFind = function(stmt, document) {
	var joins = '';
	var cols = '*';
	var group = '';
	var order = '';
	var table;

	var ret = {
		grouping: false,
		sorting: false
	};

	if (typeof stmt == 'object') {
		table = stmt.table;
		if (stmt.joins) {
			joins = this._prepareJoins(stmt.table, stmt.joins);
		}
		if (stmt.columns) {
			cols = this._prepareCols(stmt.table, stmt.columns);
		}
		if (stmt.group) {
			group = this._prepareGroup(stmt.table, stmt.group);
		}
		if (stmt.order) {
			order = this._prepareOrder(stmt.table, stmt.order);
		}

	} else {
		table = stmt;
	}

	ret.q = 'SELECT ' + cols + ' FROM `' + table + '`' + joins;
	ret.v = null;

	if (document) {
		var where = this._preparePlaceholders(stmt.table, document);
		ret.q += ' WHERE ' + where.placeholders;
		ret.v = where.values;
	}

	if (group) {
		ret.q += ' GROUP BY ' + group;
		ret.grouping = true;
	}

	if (order) {
		ret.q += ' ORDER BY ' + order;
		ret.sorting = true;
	}

	return ret;
};

/**
 * Prepares a where statement from a condition object.
 *
 * @param table
 * @param condition
 * @param noPrefix Disable table prefix for columns
 */
SA.SQLiteDb.prototype._preparePlaceholders = function(table, condition, noPrefix) {
	var values = [];
	var columns = [];

	for (var col in condition) {
		var left;

		if (noPrefix === true) {
			left = '`' + col + '`';

		} else {
			var c = col.split('.');
			if (c.length == 1) {
				left = '`' + table + '`.`';
			} else {
				left = '`' + c[0] + '`.`';
				c.shift();
			}
			left += c.join() + '`';
		}

		columns.push(left);
		values.push(condition[col]);
	}

	var placeholders = columns.join(' = ? AND ') + ' = ?';
	return {placeholders: placeholders, values: values};
};

/**
 * Compiles join statements.
 *
 * @param table
 * @param joins
 * @return {String}
 */
SA.SQLiteDb.prototype._prepareJoins = function(table, joins) {
	var ret = '';

	for (var i = 0; i < joins.length; i++) {
		var j = joins[i];
		var type = j.type ? ' ' + j.type : '';
		var on = '';

		if (typeof j.on == 'string') {
			on = j.on;

		} else {
			for (var a in j.on) {
				var left, right;
				var b = j.on[a].split('.');
				a = a.split('.');

				if (a.length == 1) {
					left = '`' + table + '`.`';
				} else {
					left = '`' + a[0] + '`.`';
					a.shift();
				}
				if (b.length == 1) {
					right = '`' + j.table + '`.`';
				} else {
					right = '`' + b[0] + '`.`';
					b.shift();
				}

				left += a.join() + '`';
				right += b.join() + '`';
				on = left + ' = ' + right;
			}
		}

		ret += type + ' JOIN `' + j.table + '` ON (' + on + ')';
	}

	return ret;
};

/**
 * Compiles a columns listt.
 *
 * @param table
 * @param cols
 * @return {String}
 */
SA.SQLiteDb.prototype._prepareCols = function(table, cols) {
	var ret = [];

	for (var c in cols) {
		if (/( AS )+/i.test(cols[c])) {
			// skip all columns with " AS " keyword
			ret.push(cols[c]);
			continue;
		}

		var col = cols[c].split('.');
		var prefix = (col.length == 1) ? table : col[0];
		var namePrefix = (col.length == 1) ? '' : col[0] + '.';

		if (col.length > 1) {
			col.shift();
		}
		var name = col.join();
		ret.push('`' + prefix + '`.`' + name + '` AS "' + namePrefix + name + '"');
	}

	return ret.join(', ');
};

/**
 * Compiles an order statement.
 *
 * @param table
 * @param order
 * @return {String}
 */
SA.SQLiteDb.prototype._prepareOrder = function(table, order) {
	var ret = [];

	for (var o in order) {
		ret.push(order[o]);
	}

	return ret.join(', ');
};

/**
 * Compiles a group statement.
 *
 * @param table
 * @param order
 * @return {String}
 */
SA.SQLiteDb.prototype._prepareGroup = function(table, group) {
	var ret = [];

	for (var g in group) {
		ret.push(group[g]);
	}

	return ret.join(', ');
};


/**
 * Returns the result of a query constructed by a document.
 *
 * @param table
 * @param document
 * @param callback
 */
SA.SQLiteDb.prototype.find = function(table, document, callback) {
	if (!callback && typeof document == 'function') {
		callback = document;
		document = null;
	}
	var obj = this._prepareFind(table, document);
	this.query(obj, callback);
};

/**
 * Returns all results of a query constructed by a document.
 *
 * @param table
 * @param document
 * @param callback
 */
SA.SQLiteDb.prototype.findArray = function(table, document, callback) {
	if (!callback && typeof document == 'function') {
		callback = document;
		document = null;
	}

	var obj = this._prepareFind(table, document);
	if (typeof table == 'object') {
		obj.perId = table.perId;
	}

	this.queryArray(obj, callback);
};

/**
 * Returns all results of a query as hashed list (first column -> second column).
 *
 * @param table
 * @param key
 * @param cols
 * @param document
 * @param callback
 */
SA.SQLiteDb.prototype.findList = function(table, key, cols, document, callback) {
	if (!callback && typeof document == 'function') {
		callback = document;
		document = null;
	}
	var obj = this._prepareFind(table, document);
	obj.key = key;
	obj.columns = cols;
	this.queryList(obj, callback);
};

/**
 * Returns the first result of a query constructed by a document.
 *
 * @param table
 * @param document
 * @param callback
 */
SA.SQLiteDb.prototype.findFirst = function(table, document, callback) {
	if (!callback && typeof document == 'function') {
		callback = document;
		document = null;
	}
	this.find(table, document, function(err, result) {
		var item = null;
		if (result) {
			if (result.rows.length > 1) {
				this._trigger('error', {
					msg: 'Query of findFirst() returned ' + result.rows.length + ' items'
				});
			}
			item = result.rows.length ? result.rows.item(0) : null;
		}
		callback(err, item);
	});
};

/**
 * Executes an update statement.
 *
 * @param table
 * @param condition (optional)
 * @param values
 * @param callback
 */
SA.SQLiteDb.prototype.update = function(table, condition, values, callback) {
	// we can run an update without a condition
	if (typeof values == 'function' || values == undefined) {
		callback = values;
		values = condition;
		condition = undefined;
	}

	if (typeof values != 'object') {
		SA.Log.e('Missing arguments in update, expecting object');
		return;
	}

	//TODO implement JOINs, if needed
	var set = this._preparePlaceholders(table, values, true);
	var query = {
		q: 'UPDATE `' + table + '` SET ' + set.placeholders,
		v: set.values
	};

	if (condition) {
		var where = this._preparePlaceholders(table, condition);
		query.q += ' WHERE ' + where.placeholders;
		query.v = query.v.concat(where.values);
	}

	this.query(query, callback);
};

/**
 * Deletes from a table.
 *
 * @param table
 * @param condition
 * @param callback
 */
SA.SQLiteDb.prototype.remove = function(table, condition, callback) {
	if (!callback && typeof condition == 'function') {
		callback = condition;
		condition = null;
	}

	var query = {q: 'DELETE FROM `' + table + '`'};

	if (condition) {
		var where = this._preparePlaceholders(table, condition);
		query.q += ' WHERE ' + where.placeholders;
		query.v = where.values;
	}

	this.query(query, callback);
};


/**
 * Drops a table
 * @param table
 */
SA.SQLiteDb.prototype._drop = function(table) {
	this.query('DROP TABLE `' + table + '`');
};


/**
 * Binds a callback to a specific event.
 *
 * @param event
 * @param callback
 */
SA.SQLiteDb.prototype.on = function(event, callback) {
	if (!this._listeners[event]) {
		this._listeners[event] = [];
	}
	this._listeners[event].push(callback);

	return this;
};

/**
 * Triggers a specific event.
 *
 * @param event
 * @param data
 */
SA.SQLiteDb.prototype._trigger = function(event, data) {
	if (!this._listeners[event]) {
		return;
	}

	var listeners = this._listeners[event].length;
	for (var l = 0; l < listeners; l++) {
		var listener = this._listeners[event][l];
		listener.apply(listener, [this, data, event]);
	}
};