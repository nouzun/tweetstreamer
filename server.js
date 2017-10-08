const Port = process.env.PORT || 8080;

const BoundingDistance = 100; // Distance (km) from the point to calculate the bounding coordinates
const StreamingDelay = process.env.DELAY || 24; // hours

const TwitterConsumerKey        = "HsE4QkMfRXMbVpYwBmelzA";
const TwitterConsumerSecret     = "4tKldZjBmBdRJHhSKUlB5Dlc9KLvI44qakGWRlKlu4";
const TwitterAccessToken        = "58745297-FuSw54eFymd7U0TzDXtlZjoUOAZvp1BRJBrhdytU6";
const TwitterAccessTokenSecret  = "Bba4qZ5NvBlqqx1G4kidqe2T57rIMBbiOKXm9ulRxGlZm";

const Express = require('express')
    , App = Express()
    , Http = require('http')
    , BodyParser = require('body-parser')
    , Mongoose = require('mongoose')
    , Server = Http.createServer(App)
    , Twit = require('twit')
    , SocketIO = require('socket.io').listen(Server)
    , GeoPoint = require('geopoint')
    , Tweet = require('./models/tweet');

const MongoDBUrl = process.env.MONGOLAB_URI || 'mongodb://localhost/tweets';

Server.listen(Port);

App.use(BodyParser.urlencoded({
    extended: true
}));

App.use(BodyParser.json());

console.log(MongoDBUrl);
console.log('StreamingDelay: ' + StreamingDelay);

Mongoose.connect(MongoDBUrl, { useMongoClient: true, promiseLibrary: global.Promise });

var TwitHandler = new Twit({
    consumer_key:         TwitterConsumerKey
    , consumer_secret:      TwitterConsumerSecret
    , access_token:         TwitterAccessToken
    , access_token_secret:  TwitterAccessTokenSecret
});

SocketIO.sockets.on('connection', function (socket) {
    console.log('Connected');
});

list_all_tweets = function(request, response) {
    var interval = setInterval(function(){
        Tweet.findOne({}, {}, { sort: { 'date' : 1 } }, function(err, storedTweet) {

            if(storedTweet){
                console.log(storedTweet.date);
                if(storedTweet.date < Date.now() - 1 * StreamingDelay * 3600 * 1000)
                {
                    console.log("It's Time: " + storedTweet );
                    SocketIO.sockets.emit('tweetStream', storedTweet);
                    // delete
                    storedTweet.remove(function(err) {
                        if (err)
                        {
                            console.log(err);
                        }
                        console.log('Tweet successfully deleted!');
                    });
                }
            }
        });
    }, 3000);

    response.sendFile(__dirname + '/delayed.html');
};

store_tweets = function(request, response) {
    console.log(request.body.latitude);
    if (isNumeric(request.body.latitude) && isNumeric(request.body.longitude))
    {
        var userLocation = new GeoPoint(parseInt(request.body.latitude), parseInt(request.body.longitude));

        var boundingCoordinates = userLocation.boundingCoordinates(BoundingDistance, true);

        if(boundingCoordinates.length == 2)
        {
            var boundingBox = [ boundingCoordinates[0].longitude(), boundingCoordinates[0].latitude(), boundingCoordinates[1].longitude(), boundingCoordinates[1].latitude() ];

            var stream = TwitHandler.stream('statuses/filter', { locations: boundingBox });

            stream.on('tweet', function (tweet) {

                var tweetObj = new Tweet();
                tweetObj.content = tweet.text;
                tweetObj.date = Date.now();

                // save the tweet and check for errors
                tweetObj.save(function(err) {
                    if (err)
                    {
                        console.log(err);
                    }
                    console.log('Store in DB: ' + tweetObj.date + ': ' + tweetObj.content);
                });
            });
        }

        response.sendFile(__dirname + '/index.html');
    }
    else
    {
        response.json({ message: 'Latitude and longitude should be numeric values.' });
    }
};

App.route('/tweets')
    .get(list_all_tweets)
    .post(store_tweets);

// routing
App.use(function(request, response) {
    response.sendFile(__dirname + '/index.html');
    //response.status(404).send({url: request.originalUrl + ' not found'})
});

function isNumeric (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
