/*jshint esversion:6, node:true*/
'use strict';

const path = require('path');
const extend = require('gextend');
const watcher = require('chokidar');
const exists = require('fs-exists-promised');

var DEFAULTS = {
    seed: {
        options:{
            depth: 0,
            //This will add a delay of 2s and 100ms polling
            awaitWriteFinish: true
        },
        entityFiles: ['*.json']
    }
};

module.exports.init = function(context, config){
    /*
     * Expose some utility functions through the
     * filesync object.
     */
    var filesync = {};
    filesync.getEntityNameFromFile = config.getEntityNameFromFile.bind(filesync);
    filesync.getFilenameFromEntity = config.getFilenameFromEntity.bind(filesync);

    let _logger = filesync.logger = context.getLogger('filesync');

    filesync.getFilepathForEntity = function(entity){
        var basepath = config.remote.path;
        var filename = config.getFilenameFromEntity(entity);
        return require('path').join(basepath, filename);
    };
    /**
     * Handler function for updated files event.
     * This will return a closure to handle events
     * triggered by the file watcher.
     *
     * @method createHandler
     *
     * @param  {Object}    context          Application context.
     * @param  {Function}  sanitizeEntity Convert from filename to entity.
     * @return {Function}  Handler closure to deal with specific events.
     */
    filesync.createHandler = function createHandler(context, sanitizeEntity) {
        return function $fileUpdatedHandler(filepath, origin) {
            filesync.logger.info('filesync event: %s at %s', filepath, origin);
            let event = filesync.getEventFromPath(filepath, origin);
            event.entity = sanitizeEntity(event.entity);
            context.emit('data.sync', event);
        };
    };

    filesync.getEventFromPath = function $getEventFromPath(filepath, origin){
        let filename = path.basename(filepath);
        let extension = path.extname(filename);
        let entity = filename.replace(extension, '');
        let type = extension.replace('.', '');

        return {
            type,
            entity,
            origin,
            filepath,
        };
    };

    filesync.notifyEventUpdate =  filesync.createHandler(context, filesync.getEntityNameFromFile);

    if(config.seed){
        let seed = config.seed;
        seed = extend({}, DEFAULTS.seed, seed);

        /*
         * Watch for JSON files at the data directory:
         */
        let seedUpdates = watcher.watch(seed.path, seed.options);

        context.resolve('datamanager').then(()=>{
            seedUpdates
                .on('add', (filepath, stats)=> filesync.notifyEventUpdate(filepath, 'seed'))
                .on('change', (filepath, stats)=> filesync.notifyEventUpdate(filepath, 'seed'));

            seed.entityFiles.map((file)=>{
                let filepath = path.join(seed.path, file);

                exists(filepath)
                    .then((filepath)=>{filesync.notifyEventUpdate(filepath, 'seed');})
                    .catch((err)=>{
                        _logger.error('filesync: seed file "%s" error.', filepath);
                        _logger.error(err.message);
                        _logger.error(err.stack);
                    });
            });
        });
    }

    if(config.remote){
        let remote = config.remote;
        remote = extend({}, DEFAULTS.remote, remote);
        //Watch for JSON files at the data directory:
        let remoteUpdates = watcher.watch(remote.path, remote.options);

        context.resolve('datamanager').then(()=>{
            remoteUpdates
                .on('add', (filepath, stats)=> filesync.notifyEventUpdate(filepath, 'remote'))
                .on('change', (filepath, stats)=> filesync.notifyEventUpdate(filepath, 'remote'));
        });
    }

    //Move to command!! :)
    context.on('filesync.remote.s3', (topic, message)=>{
        _logger.info('filesync: remote file updated');
    });

    return filesync;
};
