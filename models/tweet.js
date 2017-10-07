var mongoose     = require('mongoose');
mongoose.Promise = require('bluebird');
var Schema       = mongoose.Schema;

var TweetSchema   = new Schema({
    content: String,
    date: Date
});

module.exports = mongoose.model('Tweet', TweetSchema);

