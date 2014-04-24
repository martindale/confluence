var fs = require('fs')
  , async = require('async')
  , rest = require('restler')
  , querystring = require('querystring');

function Facebook(config) {
  this.appID     = config.appID;
  this.appSecret = config.appSecret;
  this.baseURI   = config.baseURI;
};

Facebook.prototype.get = function(path, opts, done) {
  if (typeof(opts) == 'function') { done = opts; opts = {}; }
  var self = this;

  opts.access_token = this.appID +'|'+ this.appSecret; //'app_id|app_secret'
  var remoteURL = this.baseURI + path + '?' + querystring.stringify(opts);

  if (!opts.results) { opts.results = []; }

  rest.get( remoteURL ).on('complete', function(data) {
    if (opts.all !== true) {
      return done(null, data);
    }

    if (data.data && data.data.length) {
      data.data.forEach(function(item) {
        opts.results.push( item ) 
      });
    }

    if (data.paging && data.paging.next) {
      self.get( data.paging.next , opts , done )
    } else {
      return done(null, { data: opts.results }); // emulates wrapped 'data'
    }

  });
}

module.exports = Facebook;