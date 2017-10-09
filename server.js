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

    var interval = setInterval(function(){
        Tweet.findOne({}, {}, { sort: { 'date' : 1 } }, function(err, storedTweet) {

            if(storedTweet){
                console.log(storedTweet.date);
                if(storedTweet.date < Date.now() - 1 * StreamingDelay * 3600 * 1000)
                {
                    console.log("It's Time: " + storedTweet );
                    socket.emit('tweetStream', storedTweet);
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

});

ListDelayedTweets = function(request, response) {

    response.sendFile(__dirname + '/delayed.html');
};

StoreLiveStreamingTweets = function(request, response) {
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

                Tweet.findOne({}, {}, { sort: { 'date' : 1 } }, function(err, storedTweet) {
                    if(storedTweet)
                    {
                        if(storedTweet.content != tweetObj.content)
                        {
                            // save the tweet and check for errors
                            tweetObj.save(function(err) {
                                if (err)
                                {
                                    console.log(err);
                                }
                                console.log('Store in DB: ' + tweetObj.date + ': ' + tweetObj.content);
                            });
                        }
                    }
                    else
                    {
                        // save the tweet and check for errors
                        tweetObj.save(function(err) {
                            if (err)
                            {
                                console.log(err);
                            }
                            console.log('Store in DB: ' + tweetObj.date + ': ' + tweetObj.content);
                        });
                    }
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

StoreAndListDelayedTweets = function(request, response) {
    console.log(request.params.latitude);
    if (isNumeric(request.params.latitude) && isNumeric(request.params.longitude))
    {
        var userLocation = new GeoPoint(parseInt(request.params.latitude), parseInt(request.params.longitude));

        var boundingCoordinates = userLocation.boundingCoordinates(BoundingDistance, true);

        if(boundingCoordinates.length == 2)
        {
            var boundingBox = [ boundingCoordinates[0].longitude(), boundingCoordinates[0].latitude(), boundingCoordinates[1].longitude(), boundingCoordinates[1].latitude() ];

            var stream = TwitHandler.stream('statuses/filter', { locations: boundingBox });

            stream.on('tweet', function (tweet) {

                var tweetObj = new Tweet();
                tweetObj.content = tweet.text;
                tweetObj.date = Date.now();

                Tweet.findOne({}, {}, { sort: { 'date' : 1 } }, function(err, storedTweet) {
                    if(storedTweet)
                    {
                        if(storedTweet.content != tweetObj.content)
                        {
                            // save the tweet and check for errors
                            tweetObj.save(function(err) {
                                if (err)
                                {
                                    console.log(err);
                                }
                                console.log('Store in DB: ' + tweetObj.date + ': ' + tweetObj.content);
                            });
                        }
                    }
                    else
                    {
                        // save the tweet and check for errors
                        tweetObj.save(function(err) {
                            if (err)
                            {
                                console.log(err);
                            }
                            console.log('Store in DB: ' + tweetObj.date + ': ' + tweetObj.content);
                        });
                    }
                });
            });
        }

        response.sendFile(__dirname + '/delayed.html');
    }
    else
    {
        response.json({ message: 'Latitude and longitude should be numeric values.' });
    }
};

// routing
App.route('/tweets')
    .get(ListDelayedTweets)
    .post(StoreLiveStreamingTweets);

App.route('/lat/:latitude/lng/:longitude')
    .get(StoreAndListDelayedTweets);

App.use(function(request, response) {
    response.sendFile(__dirname + '/index.html');
});

function isNumeric (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
