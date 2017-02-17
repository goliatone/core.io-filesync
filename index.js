/*jshint esversion:6, node:true*/
'use strict';

/*
 * Expose Filesync
 */
module.exports = require('./lib/filesync');

module.exports.Filesync = require('./lib/filesync');

/*
 * Default initializer for the module.
 *
 * You can always override this and make
 * a custom initializer.
 */
module.exports.init = require('./lib/init');
