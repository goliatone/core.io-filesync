/*jshint esversion:6, node:true*/
'use strict';
const extend = require('gextend');
const Filesync = require('./filesync');
const DEFAULTS = require('./defaults');

module.exports = function(context, config) {

    let _logger = context.getLogger('filesync');

    _logger.info('Initializing filesync module...');

    /*
     * Ensure we have the minimal config
     */
    config = extend({}, DEFAULTS, config);

    //Move to command!! :)
    context.on(config.filesyncEventType, (topic, message) => {
        _logger.info('filesync: remote file updated');
    });

    return new Promise(function(resolve, reject) {

        context.resolve('datamanager').then(()=>{
            /*
             * Expose some utility functions through the
             * filesync object.
             */
            var filesync = new Filesync(context, config);
            resolve(filesync);
        });
    });
};
