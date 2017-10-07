const Port = process.env.PORT || 8080;

var BoundingDistance = 100; // Distance (km) from the point to calculate the bounding coordinates
var StreamingDelay = 1; // hours

const TwitterConsumerKey        = "HsE4QkMfRXMbVpYwBmelzA";
const TwitterConsumerSecret     = "4tKldZjBmBdRJHhSKUlB5Dlc9KLvI44qakGWRlKlu4";
const TwitterAccessToken        = "58745297-FuSw54eFymd7U0TzDXtlZjoUOAZvp1BRJBrhdytU6";
const TwitterAccessTokenSecret  = "Bba4qZ5NvBlqqx1G4kidqe2T57rIMBbiOKXm9ulRxGlZm";

const Express = require('express')
    , App = Express()
    , Http = require('http')
    , mongoose = require('mongoose')
    , Server = Http.createServer(App)
    , Twit = require('twit')
    , SocketIO = require('socket.io').listen(Server)
    , GeoPoint = require('geopoint')
    , Tweet = require('./models/tweet');

Server.listen(Port);

var MongoDBUrl = process.env.MONGOLAB_URI || 'mongodb://localhost/tweets';
console.log(MongoDBUrl);

mongoose.connect(MongoDBUrl, { useMongoClient: true, promiseLibrary: global.Promise });

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
                    SocketIO.sockets.emit('tweetStream', storedTweet.content);
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

// routing
App.route('/').get(function(request, response) {
    response.json({ message: 'Usage is http://URL/latitude/[latitude]/longitude/[longitude]' });
});

App.route('/latitude/:latitude/longitude/:longitude').get(function(request, response) {

    if (isNumeric(request.params.latitude) && isNumeric(request.params.longitude))
    {
        var userLocation = new GeoPoint(parseInt(request.params.latitude), parseInt(request.params.longitude));

        var boundingCoordinates = userLocation.boundingCoordinates(BoundingDistance, true);

        if(boundingCoordinates.length == 2)
        {
            var boundingBox = [ boundingCoordinates[0].longitude(), boundingCoordinates[0].latitude(), boundingCoordinates[1].longitude(), boundingCoordinates[1].latitude() ];

            var stream = TwitHandler.stream('statuses/filter', { locations: boundingBox });

            TweetStreamIntoDatabase(stream);
        }

        response.sendFile(__dirname + '/delayed.html');
    }
    else
    {
        response.json({ message: 'Latitude and longitude should be numeric values.' });
    }
});

function TweetStreamIntoDatabase(stream)
{
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
        });
    });
}

function isNumeric (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
