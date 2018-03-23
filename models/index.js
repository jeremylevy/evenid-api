var path = require('path');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../config');

var directories = require('../utils/directories');

var models = {};

var excludedFolders = ['actions', 'methods', 
                       'middlewares', 'properties',
                       'validators'];

// Import each model from the models directory
directories.loadDirSync(__dirname, excludedFolders, function (file) {

    var name = path.basename(file, '.js');
    var schema = require('./' + name);
    
    // No index during dev (slow)
    // schema.set('autoIndex', config.ENV === 'production');

    // Implement hide option to toObject method
    // to hide certains columns
    if (!schema.options.toObject) {
        schema.options.toObject = {};
    }
    
    // Default hide `_id` and `__v` columns
    if (Type.is(schema.options.toObject.hide, undefined)) {
        schema.options.toObject.hide = '_id __v';
    }
    
    // Default don't remove empty objects
    if (Type.is(schema.options.toObject.minimize, undefined)) {
        schema.options.toObject.minimize = false;
    }

    // Add `hide` and `show` options to `toObject()` method
    schema.options.toObject.transform = function (doc, ret, options) {
        var toHide = [];
        var toShow = [];
        var replace = [];
        var replaceBy = [];
        var replaceIdx = null;

        if (options.hide && options.show) {
            throw new Error('You must choose between hide and show options when calling toObject method');
        }

        // Hide properties 
        // contained in `hide` option
        if (options.hide) {
            toHide = options.hide.split(' ');

            toHide.forEach(function (prop) {
                // Replace _id with id
                if (prop === '_id'
                    // Make sure id is not to hide
                    && toHide.indexOf('id') === -1) {

                    ret.id = ret._id;
                }

                delete ret[prop];
            });
        }

        // Only show properties 
        // contained in `show` option
        if (options.show) {
            toShow = options.show.split(' ');

            for (var prop in ret) {
                if (toShow.indexOf(prop) !== -1) {
                    continue;
                }

                delete ret[prop];
            }
        }

        // Replace passed field names by others
        if (options.replace) {
            replace = options.replace[0];
            replaceBy = options.replace[1];

            if (replace.length !== replaceBy.length) {
                throw new Error('You must set the same number of elements in replace and replace by array');
            }

            for (var prop in ret) {
                replaceIdx = replace.indexOf(prop);

                if (replaceIdx === -1) {
                    continue;
                }

                ret[replaceBy[replaceIdx]] = ret[prop];

                delete ret[prop];
            }
        }
    };

    // Create Model object from Schema
    models[name] = mongoose.model(name, schema);
});

module.exports.models = models;
module.exports.connect = function (cb) {
    cb || (cb = function () {});

    // Mongoose is already connected
    // Good during testing
    if (mongoose.connection.readyState) {
        return cb(null);
    }

    mongoose.set('debug', config.ENV === 'development');

    mongoose.connect(config.EVENID_MONGODB.URI);

    mongoose.connection.on('error', cb);
    mongoose.connection.on('open', cb);
};