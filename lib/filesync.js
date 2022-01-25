/*jshint esversion:6, node:true*/
'use strict';

const path = require('path');
const extend = require('gextend');
const words = require('pluralize');
const watcher = require('chokidar');
const exists = require('fs-exists-promised');
const logger = require('noop-console').logger();

class Filesync {
    constructor(context, config) {

        config = extend({}, Filesync.DEFAULTS, config);

        this.context = context;

        this.init(config);
    }

    init(config) {
        extend(this, config);

        this.notifyEventUpdate = this._createHandler(this.getEntityNameFromFile);

        if (this.seed) this.setupSeed();
        if (this.remote) this.setupRemote();
    }

    /**
     * We follow a convention to create
     * entity filenames:
     * Pluralize the entity name and attach
     * a JSON extension.
     *
     * @param  {String} entity
     * @param  {Object} context
     * @return {String} Filename and extension
     */
    getFilenameFromEntity(entity, context) {
        entity = words.plural(entity);
        return `${entity}.json`;
    }

    /**
     * We follow a naming convention
     * in order to map the data filename
     * to the entities it contains.
     *
     * The filename should have the plural
     * noun of the entity.
     *
     * ```
     * entities.json -> entities -> entity
     * users.json -> users -> user
     * ```
     * @param  {String} entity
     * @param  {Object} context
     * @return {String} Entity name
     */
    getEntityNameFromFile(entity, context) {
        return words.singular(entity);
    }


    getFilepathForEntity(entity) {
        const basepath = this.remote.path;
        const filename = this.getFilenameFromEntity(entity);
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
        const filesync = this;
        const context = this.context;

        /**
         * Handler used to watch over file updates and send notifications.
         * @method $fileUpdatedHandler
         * @param  {String}            filepath File to be watched
         * @param  {String}            origin   remote|seed
         * @param  {String}            action   add|change|boot
         * @param  {Object}            stats    Stats object
         * @see https://nodejs.org/api/fs.html#fs_class_fs_stats
         * @return {void}
         */
        return function $fileUpdatedHandler(filepath, origin, action, stats) {
            filesync.logger.debug('filesync event: %s at %s: %s', filepath, origin, action);
            const event = filesync.getEventFromPath(filepath, origin, action);
            event.stats = stats;
            event.entity = sanitizeEntity(event.entity, context);
            context.emit('data.sync', event);
        };
    }

    /**
     * Build event for a given action.
     *
     * @param {String} filepath Path to file
     * @param {String} origin Either seed or remote
     * @param {String} action add|change|boot
     * @return {Object} Event object
     */
    getEventFromPath(filepath, origin, action) {
        const filename = path.basename(filepath);
        const extension = path.extname(filename);
        const entity = filename.replace(extension, '');

        const type = extension.replace('.', '');

        const errorsPath = this[origin].errorsPath;
        const historyPath = this[origin].historyPath;
        const moveAfterDone = this[origin].moveAfterDone;

        return {
            type,
            entity,
            origin,
            action,
            filepath,
            errorsPath,
            historyPath,
            moveAfterDone
        };
    }

    setupSeed() {

        const seed = extend({}, this.defaults.seed, this.seed);

        //@TODO: should we make async?
        if (!fileExists(seed.path)) {
            this.logger.error('Path does not exists. Module filesync will not work!');
            this.logger.error('Path is: %s', seed.path);
            this.logger.error('options: %j', seed.options);
        }

        /*
         * Watch for JSON files at the data directory:
         */
        const seedUpdates = watcher.watch(seed.path, seed.options);

        this.context.resolve('datamanager').then(_ => {
            this.logger.info('Dependency "datamanager" resolved ....');

            seedUpdates
                .on('add', (filepath, stats) => this.notifyEventUpdate(filepath, 'seed', 'add', stats))
                .on('change', (filepath, stats) => this.notifyEventUpdate(filepath, 'seed', 'change', stats));

            seed.entityFiles.map(file => {
                const filepath = path.join(seed.path, file);
                this.logger.debug('--->file', filepath);

                exists(filepath)
                    .then(filepath => { this.notifyEventUpdate(filepath, 'seed', 'boot'); })
                    .catch(err => {
                        this.logger.error('filesync: seed file "%s" error.', filepath);
                        this.logger.error(err.message);
                        this.logger.error(err.stack);
                    });
            });
        });
    }

    setupRemote() {
        const remote = extend({}, this.defaults.remote, this.remote);
        //Watch for JSON files at the data directory:
        const remoteUpdates = watcher.watch(remote.path, remote.options);

        this.context.resolve('datamanager').then(_ => {
            remoteUpdates
                .on('add', (filepath, stats) => this.notifyEventUpdate(filepath, 'remote', 'add', stats))
                .on('change', (filepath, stats) => this.notifyEventUpdate(filepath, 'remote', 'change', stats));
        });
    }
}

Filesync.DEFAULTS = {
    logger,
    defaults: {
        seed: {
            options: {
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
