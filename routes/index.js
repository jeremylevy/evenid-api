var directories = require('../utils/directories');

module.exports = function (app, express) {
    var excludedFolders = ['middlewares', 'callbacks'];

    // Load each files in the routes directory
    directories.loadDirSync(__dirname, excludedFolders, function (filePath) {
        require(filePath)(app, express);
    });
};