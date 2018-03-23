module.exports = function (app, express) {
    app.get('/health', function (req, res) {
        res.sendStatus(200);
    });
};