var path = require('path');

var config = require('../../config');

var directories = require('../../utils/directories');

var excludedFolders = [];
var data = {};

var enabledLocales = config.EVENID_LOCALES
                           .ENABLED;

// Load each files in the data directory
directories.loadDirSync(__dirname, excludedFolders,
                        function (filePath) {
    
    // Without ext
    var fileName = path.basename(filePath, '.json');
    // Folders in the path
    var folders = path.dirname(filePath)
                      .split(path.sep);
    
    var currentLocale = null;

    // Bubble up from folder 
    // containing file to root.
    // Get the locale containing folder
    for (var i = folders.length - 1, j = 0; i > j; i--) {
        // Files set in data folder root
        // (ie: without locale)
        if (folders[i] === 'data') {
            break;
        }

        // In case we have subdirectories
        // in locale folders
        if (!folders[i].match(new RegExp(enabledLocales.join('|')))) {
            continue;
        }

        currentLocale = folders[i];
        break;
    }

    // Files set in data folder root
    if (!currentLocale) {
        data[fileName] = require(filePath);
        return;
    }

    if (!data[currentLocale]) {
        data[currentLocale] = {};
    }

    data[currentLocale][fileName] = require(filePath);
});

module.exports = data;