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

    getFilenameFromEntity(entity, context) {
        throw new Error('Implement');
    }

    getEntityNameFromFile(entity, context) {
        throw new Error('Implement');
    }

    getFilepathForEntity(entity) {
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

        /**
         * Handler used to watch over file updates and send notifications.
         * @method $fileUpdatedHandler
         * @param  {String}            filepath File to be watched
         * @param  {String}            origin   remote|seed
         * @param  {String}            action   add|change|boot
         * @return {void}
         */
        return function $fileUpdatedHandler(filepath, origin, action) {
            filesync.logger.info('filesync event: %s at %s: %s', filepath, origin, action);
            let event = filesync.getEventFromPath(filepath, origin, action);
            event.entity = sanitizeEntity(event.entity, context);
            context.emit('data.sync', event);
        };
    }

    getEventFromPath(filepath, origin, action) {
        let filename = path.basename(filepath);
        let extension = path.extname(filename);
        let entity = filename.replace(extension, '');
        let type = extension.replace('.', '');

        return {
            type,
            entity,
            origin,
            action,
            filepath,
        };
    }

    setupSeed(){
        let seed = this.seed;
        seed = extend({}, this.defaults.seed, seed);

        //@TODO: should we make async?
        if(!fileExists(seed.path)) {
            this.logger.error('Path does not exists. Module filesync will not work!');
            this.logger.error('Path is: %s', seed.path);
            this.logger.error('options: %j', seed.options)
        }

        /*
         * Watch for JSON files at the data directory:
         */
        let seedUpdates = watcher.watch(seed.path, seed.options);

        this.context.resolve('datamanager').then(()=> {
            this.logger.info('Dependency "datamanager" resolved ....');

            seedUpdates
                .on('add', (filepath, stats)=> this.notifyEventUpdate(filepath, 'seed', 'add'))
                .on('change', (filepath, stats)=> this.notifyEventUpdate(filepath, 'seed', 'change'));

            seed.entityFiles.map((file) => {
                let filepath = path.join(seed.path, file);
                console.log('--->file', filepath);

                exists(filepath)
                    .then((filepath)=>{this.notifyEventUpdate(filepath, 'seed', 'boot');})
                    .catch((err)=> {
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
                .on('add', (filepath, stats)=> this.notifyEventUpdate(filepath, 'remote', 'add'))
                .on('change', (filepath, stats)=> this.notifyEventUpdate(filepath, 'remote', 'change'));
        });
    }
}

Filesync.DEFAULTS = {
    logger: console,
    defaults:{
        seed: {
            options:{
                depth: 0,
                /*
                 * Do we want to emit `add` events
                 * the first time we bring the watcher
                 * up?
                 */
                ignoreInitial: false,
                //This will add a delay of 2s and 100ms polling
                awaitWriteFinish: true
            },
            entityFiles: []
        }
    }
};

module.exports = Filesync;

function fileExists(filepath) {
    const fs = require('fs');
    return fs.existsSync(filepath);
}
