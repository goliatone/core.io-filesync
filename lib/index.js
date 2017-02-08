/*jshint esversion:6, node:true*/
'use strict';

const path = require('path');
const extend = require('gextend');
const watcher = require('chokidar');
const exists = require('fs-exists-promised');

class Filesync {
    constructor(context, config){

        config = extend({}, Filesync.DEFAULTS, config);

        this.context = context;

        this.init(config);
    }

    init(config){
        extend(this, config);

        this.notifyEventUpdate =  this._createHandler(this.getEntityNameFromFile);

        if(this.seed) this.setupSeed();
        if(this.remote) this.setupRemote();
    }

    getFilenameFromEntity(){
        throw new Error('Implement');
    }

    getEntityNameFromFile(){
        throw new Error('Implement');
    }

    getFilepathForEntity(entity){
        let basepath = this.remote.path;
        let filename = this.getFilenameFromEntity(entity);
        return path.join(basepath, filename);
    }

    /**
     * Handler function for updated files event.
     * This will return a closure to handle events
     * triggered by the file watcher.
     *
     * @method createHandler
     *
     * @param  {Function}  sanitizeEntity Convert from filename to entity.
     * @return {Function}  Handler closure to deal with specific events.
     */
    _createHandler(sanitizeEntity) {
        let filesync = this;
        let context = this.context;

        return function $fileUpdatedHandler(filepath, origin) {
            filesync.logger.info('filesync event: %s at %s', filepath, origin);
            let event = filesync.getEventFromPath(filepath, origin);
            event.entity = sanitizeEntity(event.entity);
            context.emit('data.sync', event);
        };
    }

    getEventFromPath(filepath, origin){
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
    }

    setupSeed(){
        let seed = this.seed;
        seed = extend({}, this.defaults.seed, seed);

        /*
         * Watch for JSON files at the data directory:
         */
        let seedUpdates = watcher.watch(seed.path, seed.options);

        this.context.resolve('datamanager').then(()=>{
            seedUpdates
                .on('add', (filepath, stats)=> this.notifyEventUpdate(filepath, 'seed'))
                .on('change', (filepath, stats)=> this.notifyEventUpdate(filepath, 'seed'));

            seed.entityFiles.map((file)=>{
                let filepath = path.join(seed.path, file);

                exists(filepath)
                    .then((filepath)=>{this.notifyEventUpdate(filepath, 'seed');})
                    .catch((err)=>{
                        this.logger.error('filesync: seed file "%s" error.', filepath);
                        this.logger.error(err.message);
                        this.logger.error(err.stack);
                    });
            });
        });
    }

    setupRemote(){
        let remote = this.remote;
        remote = extend({}, this.defaults.remote, remote);
        //Watch for JSON files at the data directory:
        let remoteUpdates = watcher.watch(remote.path, remote.options);

        this.context.resolve('datamanager').then(()=>{
            remoteUpdates
                .on('add', (filepath, stats)=> this.notifyEventUpdate(filepath, 'remote'))
                .on('change', (filepath, stats)=> this.notifyEventUpdate(filepath, 'remote'));
        });
    }
}

Filesync.DEFAULTS = {
    logger: console,
    defaults:{
        seed: {
            options:{
                depth: 0,
                //This will add a delay of 2s and 100ms polling
                awaitWriteFinish: true
            },
            entityFiles: ['*.json']
        }
    }
};

module.exports = Filesync;
