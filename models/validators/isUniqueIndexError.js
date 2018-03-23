module.exports = function (err) {
    if (!err) {
        return false;
    }

    return err.name === 'MongoError' 
        && [11000, 11001].indexOf(err.code) !== -1;
};