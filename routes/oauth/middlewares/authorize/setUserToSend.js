module.exports = function (req, res, next) {
    var user = res.locals.user;

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `setUserToSend` '
                        + 'middleware');
    }

    // Inputs displayed during oauth authorization
    // are shared with app and use an `user` var
    // to prefill the fields
    res.locals.userToSend = {
        // Needed to get upload policy for profil photo
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        nickname: user.nickname,
        profil_photo: user.profil_photo,
        gender: user.gender,
        date_of_birth: user.date_of_birth,
        place_of_birth: user.place_of_birth,
        nationality: user.nationality,
        timezone: user.timezone
    };

    next();
};