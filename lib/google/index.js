var rest = require('restler')
  , sys = require('sys')
  , querystring = require('querystring');

function Google(auth, profile) {
  this.auth       = auth;
  this.profile    = {
      id: profile
    , activities: []
  };
  this.baseURI = 'https://www.googleapis.com/plus/v1/';
  this.uri = 'https://www.googleapis.com/plus/v1/people/'+ this.profile.id +'/activities/public?maxResults=100&key=' + this.auth;
};

Google.prototype.get = function(path, opts, done) {
  if (typeof(opts) == 'function') { done = opts; opts = {}; }
  opts.key = this.auth;
  var remoteURL = this.baseURI + path + '?' + querystring.stringify(opts);
  rest.get( remoteURL ).on('complete', function(data) {
    if (data.error) {
      done(data.error);
    } else {
      done(null, data);
    }
  });
}

Google.prototype.getActivities = function(pageID, done) {
  var self = this;

  if (!pageID) { self.profile.activities = []; }

  rest.get( (pageID) ? self.uri + '&pageToken=' + pageID : self.uri ).on('complete', function(data) {

    console.log(data);

    if (!data.items) { console.log('no items!!!'); } else {
      console.log(data.items.length + ' items found!!!');
      data.items.forEach(function(activity) {
        self.profile.activities.push(activity);
      });
    }
    console.log('next page: ' + data.nextPageToken);

    if (data.nextPageToken) {
      self.getActivities( data.nextPageToken , done );
    } else {
      done( self.profile.activities );
    }
  });
};

Google.prototype.getComments = function(activityID, done) {
  var self = this;

  rest.get( self.baseURI + 'activities/' + activityID + '/comments' )
};

module.exports = Google;