var fs = require('fs');
var path = require('path');

module.exports.loadDirSync = function (dirPath, blacklist, cb) {
    cb = blacklist instanceof Function ? blacklist : cb;
    blacklist = blacklist instanceof Array ? blacklist.concat(['index.js']) : ['index.js'];

    var readDir = function (dirPath) {
        fs
            .readdirSync(dirPath)
            .filter(function (file) {
                return (file.indexOf('.') !== 0) && (blacklist.indexOf(file) === -1);
            })
            .forEach(function (file) {
                var filePath = path.join(dirPath, file);
                var isDir = fs.lstatSync(filePath).isDirectory();

                if (isDir) {
                    return readDir(filePath);
                }
                
                if (cb) {
                    cb(filePath);
                }
            });
    };

    readDir(dirPath);
};