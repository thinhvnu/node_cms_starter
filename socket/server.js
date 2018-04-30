const platform = require('platform');
const Auth = require('./../helpers/auth');
const LoginManager = require('./../models/LoginManager');

var ioAuthenticatedEvents = function(io, socket) {
    /* User join to personal room */
    socket.join(socket.user._id);
    /* Ignore duplicate connection when restart server */
    // io.removeAllListeners();

    /**
     * Update login manager collections
     */
    const p = platform.parse(socket.request.headers['user-agent']);
    
    if (p) {
        let newLogin = new LoginManager();
        newLogin.user = socket.user._id;
        newLogin.userName = socket.user.userName,
        newLogin.fullName = socket.user.fullName,
        newLogin.sessionId = io.sessionID;
        newLogin.os = p.os;
        newLogin.platform = p.name;
        newLogin.save();
    }

    /**
     * Event send message
     */
    socket.on('send_message', (data) => {
        data.sender = socket.user;

        console.log('dataSend', data);

        io.to(data.to._id).emit('message', data);

        /**
         * Event send message to sender
         */
        io.to(socket.user._id).emit('owner_message', data);
    })

    /**
     * Event socket disconnected
     */
    socket.on('disconnect', () => {
        /* Remove device login */
        LoginManager.findOne({sessionId: io.sessionID}).exec((err, deviceLogin) => {
            if (deviceLogin) {
                deviceLogin.remove();
            }
        });
    })
}

var ioEvents = function(io) {
    io.on('connection', (socket) => {
        let user = {};
        if (socket.request.session && socket.request.session.user) {
            user = socket.request.session.user;
            if (user && user._id) {
                socket.user = user;
                ioAuthenticatedEvents(io, socket);
            } else {
                console.log('server disconnect');
                socket.emit('authenticate_failed');
                // socket.disconnect(true);
            }
        } else {
            let token = socket.handshake.query.token || socket.handshake.headers['x-access-token'] || socket.handshake.headers['Authorization'] || socket.handshake.headers['authorization'];
        
            /**
             * Remove bearer or basic
             */
            if (token){
                token = token.split(' ');
                token = token[token.length - 1];
            }
            Auth.jwtVerifyToken(token, user => {
                if (user && user._id) {
                    socket.user = user;
                    ioAuthenticatedEvents(io, socket);
                } else {
                    console.log('server disconnect');
                    socket.emit('authenticate_failed');
                    // socket.disconnect(true);
                }
            });
        }
    })
}

module.exports = ioEvents;