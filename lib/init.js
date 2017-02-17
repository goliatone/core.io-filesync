/*jshint esversion:6, node:true*/
'use strict';

const Filesync = require('./filesync');

module.exports.init = function(context, config){

    let _logger = context.getLogger('filesync');

    /*
     * Expose some utility functions through the
     * filesync object.
     */
    var filesync = new Filesync(context, config);

    //Move to command!! :)
    context.on('filesync.remote.s3', (topic, message)=>{
        _logger.info('filesync: remote file updated');
    });

    return filesync;
};
