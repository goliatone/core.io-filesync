'use strict';

var fs = require('fs');
var S3FS = require('s3fs');
var join = require('path').join;

/**
 * Pulls a file from an S3 bucket and saves
 * it locally.
 * @param  {String} type Event type
 * @param  {Object} event Object carrying information
 * @return {void}
 */
module.exports = function filesyncS3Update(topic, event){
    /*
     * Get config options from filesync section.
     */
    var config = this.config.get('filesync.s3');

    var bucket = config.bucket;
    var options = config.options;

    var filename = event.payload.filename;
    var filepath = join(config.path, filename);

    var s3 = new S3FS(bucket, options);

    s3.readFile(filename).then((f) => {
        var content = f.Body.toString();
        fs.writeFile(filepath, content, (err)=>{
            if(err) return handleError(this, err);
            this.logger.info('file downloaded and synced');
        });
    }, handleError.bind(this));

    function handleError(app, err){
        app.logger.error('filesyncS3Update command failed');
        app.logger.error(err.message);
        app.logger.error(err.stack);
    }
};
