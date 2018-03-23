var mongoose = require('mongoose');

module.exports = function (error) {
    return error instanceof mongoose.Error 
        && error.name === 'CastError';
};