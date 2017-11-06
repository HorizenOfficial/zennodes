const express = require('express');
const bitcoin = require('bitcoin');
const config = require('./config');
const redis = require("redis");
const geoip2 = require('geoip2');
const async = require('async');
const url = require('url');

const app = express();
const node = new bitcoin.Client(config.node);
const server = require('http').createServer(app);
const io = require('socket.io')(server);
geoip2.init('./GeoLite2-City_20170801/GeoLite2-City.mmdb');
const rediscli = redis.createClient();

var peerInfo = [];
var peerLoc = [];

function getInfo() {
    var info = [];
    var location = [];
    var count = 0;

    rediscli.smembers('opendata', (err, reply) => {
        var total = reply.length;
        var regex = /u|[(]|[)]|'| /gi

        for (var peer in reply) {
            (function(index) {
                var replaced = reply[peer].replace(regex, '')
                var arr2 = replaced.split(',')
                info.push(arr2)

                geoip2.lookupSimple(arr2[0], (err, body) => {
                    if (err || !body) {
                        body = {
                            loc: '0,0,0',
                            country: 'unknown',
                            ip: arr2[0]
                        };
                    } else {
                        body.loc = body.location.latitude + ',' + body.location.longitude + ',0.01'
                        body.ip = arr2[0];
                    }

                    location.push(body)
                    count++;

                    if (count > total - 1) {
                        peerLoc = location;
                        peerInfo = info;
                    }
                });
            })(peer);
        }
    });
}

function start(port) {
    getInfo();
    setInterval(getInfo, 1000);

    app.use('/', express.static('public'));

    app.get('/nodes', function (req, res) {
        res.send("<style>body { white-space: pre; font-family: monospace; }</style><body></body><script>document.body.innerHTML = ''; document.body.appendChild(document.createTextNode(JSON.stringify("+ JSON.stringify(peerInfo) + ", null, 4)));</script>")
    })

    io.on('connection', function(socket) {
        console.log('Connection!!! %s', socket.id);
        io.emit('peerLoc', peerLoc);
        io.emit('peerInfo', peerInfo);
    });

    server.listen(port);
    console.log('Server listening on port %s', port);
};

start(config.server.port);
