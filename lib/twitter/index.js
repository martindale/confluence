var fs = require('fs')
  , async = require('async')
  , mtwitter = require('mtwitter')
  , bigint = require('bigint');

function Twitter(config) {
  this.config = config;

  this.twitter = new mtwitter({
      consumer_key:        config.consumerKey
    , consumer_secret:     config.consumerSecret
    , access_token_key:    config.accessTokenKey
    , access_token_secret: config.accessTokenSecret
  });
};

Twitter.prototype.get = function(path, opts, done) {
  this.twitter.get( path, opts, done );
}

Twitter.prototype.getTimeline = function(type, opts, done) {
  if (typeof(opts) == 'function') { done = opts; opts = {}; }

  var self = this;

  var twitterOpts = {
      screen_name: self.config.username
    , exclude_replies: true
    , include_rts: false
    , count: 200
  };
  if (opts.oldestID) twitterOpts.max_id = opts.oldestID.toString();

  self.get('statuses/' + type , twitterOpts , function(err, tweets) {
    if (err) { console.log(err); console.log(tweets); return done(err); }

    if (opts.all !== true) {
      return done(err, tweets);
    }

    if (!opts.results) { opts.results = []; }
    if (!tweets.length) { return done(err, opts.results); }

    var originalLength = opts.results.length;
    tweets.forEach( function(tweet) {
      if (opts.results.map(function(x) { return x.id_str; }).indexOf( tweet.id_str ) == -1) {
        opts.results.push( tweet );
      }

      if (!opts.oldestID || opts.oldestID.gt( bigint( tweet.id_str ) ) ) {
        opts.oldestID = bigint( tweet.id_str );
      }
    });
    if (originalLength == opts.results.length) { return done(err, opts.results); }

    return self.getTimeline( opts , done );

  });
};

module.exports = Twitter;
