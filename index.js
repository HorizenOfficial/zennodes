const express = require('express');
const bitcoin = require('bitcoin');
const config = require('./config');
const geoip2 = require('geoip2');
const async = require('async');
const url = require('url');

const app = express();
const node = new bitcoin.Client(config.node);
const server = require('http').createServer(app);
const io = require('socket.io')(server);
geoip2.init('./GeoLite2-City_20170801/GeoLite2-City.mmdb');

var peerInfo = null;

function getInfo(next) {
    node.cmd('getpeerinfo', (err, res, resHeaders) => {
        if (err) throw err;

        peerInfo = res;
        io.emit('peerInfo', res);

        if (next)
            getLoc(res);
    });

    node.cmd('getblockchaininfo', (err, res, resHeaders) => {
        if (err) throw err;

        io.emit('getInfo', res);
    });
}

function getLoc(peerData) {
    var arr = [];
    var total = peerData.length;
    var count = 0;

    for (var peer in peerData) {
        (function(index) {
            const peerIP = url.parse('http://'+peerData[index].addr).hostname;
            geoip2.lookupSimple(peerIP, (err, body) => {
                if (err || !body) {
                    body = {
                        loc: '0,0,0',
                        country: 'unknown',
                        ip: peerIP
                    };
                } else {
                    body.loc = body.location.latitude + ',' + body.location.longitude + ',0.2'
                    body.ip = peerIP;
                }

                arr.push(body)
                count++;

                if (count > total - 1) {
                   peerLoc = arr;
                   io.emit('peerLoc', arr);
                }
            });
        })(peer);
    }
}

function start(port) {
    getInfo(node, true);

    const delayed  = function () {
        getLoc(peerInfo);
    };

    setInterval(getInfo, 200, false);
    setInterval(delayed, 1000);

    app.use('/', express.static('public'));

    io.on('connection', function(socket) {
        console.log('Connection!!! %s', socket.id);
    });

    server.listen(port);
    console.log('Server listening on port %s', port);
};


start(config.server.port);
