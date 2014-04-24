var config = require('../../config')
  , async = require('async')
  , _ = require('underscore');

var Google   = require('../google');
var Facebook = require('../facebook');
var Twitter  = require('../twitter');
var Local    = require('../local');

function Engine(app) {
  this.app = app;
  this.providers = {
      local: new Local( config.local )
    , google: new Google( config.auth.google , config.profiles.google )
    , facebook: new Facebook(  )
    , twitter: new Twitter(  )
  }
  //this._author = '527fe1125a040c9173000006';
};
Engine.prototype.init = function( target , callback ) {
  var self = this;
  Person.findOne({ slug: target }).exec(function(err, owner) {
    if (!err && owner) {
      self._author = owner._id;
    }
    callback();
  });
};
Engine.prototype.processFacebookPost = function(item, postComplete) {
  var self = this;

  if (item.id.indexOf('_') >= 0) {
    item.id = item.id.replace(/(\d*)_(\d*)/ig, '$2');
  }

  self.getPerson('facebook', item.from.id , item.from , function(err, person) {
    var urlKey = 'https://www.facebook.com/'+item.from.id+'/posts/'+item.id;

    if (item.inReplyTo) {
      urlKey = item.inReplyTo.uri + '?comment_id=' + item.id;
    }

    self.getPost('facebook', urlKey, item, function(err, post) {

      async.waterfall([
        function(cascadeComplete) {
          person.save(function(err) {
            if (err) { console.log('error saving person: ' + err); }
            cascadeComplete(err);
          });
        },
        function(cascadeComplete) {
          post._author = person._id;

          if (!item.message) {
            item.message = item.name;
          }

          if (!post.updated || new Date(item.updated_time) > post.updated) {
            post.title = item.message.split(' ').slice(0, 6).join(' ') + '...';
            post.content = item.message;

            post.created = new Date( item.created_time );
            post.published = new Date( item.created_time );
            post.updated = new Date( item.updated_time );
          }

          if (item.link) {
            post.attachments = [ {
                url: item.link
              , title: item.name
              , description: item.description
              , image: { url: item.picture }
            } ];
          }

          post.save(function(err) {
            if (err) { console.log(err); }
            cascadeComplete(err);
          });

        },
        function(cascadeComplete) {

          if (!item.inReplyTo) {
            console.log('item has no inReplyTo');
            return cascadeComplete(null);
          } else {
            console.log(item.inReplyTo);
            console.log('^ item has inReplyTo');
          }

          var reply = post; // rename to reply so we can copy the Google code, maybe DRY it later
          self.getPost('facebook', item.inReplyTo.uri , item.inReplyTo , function(err, parent) {
            // begin DRY-able
            var replyMap = {};
            parent.replies.forEach(function(reply) {
              replyMap[ reply._post ] = reply;
            });
            if (Object.keys( replyMap ).indexOf( post._id.toString() ) == -1) {
              parent.replies.push({
                  _author: person._id
                , _post: post._id
              });
            }
            parent.save(function(err) {
              if (err) { console.log(err); return cascadeComplete(err); }

              post._author = person._id;
              post._parent = parent._id;

              console.log(post);
              console.log('^- modified post')

              post.save(function(err) {
                if (err) { console.log(err); return cascadeComplete(err); }
                cascadeComplete(err);
              });
            });

            // end DRY-able
          });
        }
      ], function(err, results) {
        postComplete(err, results);
      });
    });
  });
};
Engine.prototype.processTweet = function(tweet, tweetComplete) {
  var self = this;

  console.log('processing tweet ' + tweet);

  self.getPerson( 'twitter' , tweet.user.id_str , tweet.user , function(err, person) {
    var urlKey = 'http://twitter.com/' + tweet.user.screen_name + '/status/' + tweet.id_str;
    self.getPost('twitter', urlKey, tweet, function(err, post) {
      async.waterfall([
        function(cascadeComplete) {
          person.save(function(err) {
            if (err) { console.log('error saving person: ' + err); }
            cascadeComplete(err);
          });
        },
        function(cascadeComplete) {
          post._author = person._id;

          var attachmentMap = {};
          post.attachments.forEach(function(attachment) {
            attachmentMap[ attachment.url ] = attachment;
          });

          var textParser = require('twitter-text');

          if (tweet.entities && tweet.entities.urls) {
            tweet.entities.urls.forEach(function(attachment) {

              // strip urls
              var s = tweet.text.split('');
              s.splice( attachment.indices[0], attachment.indices[1] );
              tweet.text = s.join('');

              if ( Object.keys( attachmentMap ).indexOf( attachment.expanded_url ) == -1) {
                attachmentMap[ attachment.expanded_url ] = {
                    url: attachment.expanded_url
                  , title: attachment.display_url
                  , description: attachment.display_url
                  , image: {
                      url: (attachment.image) ? attachment.image.url : undefined
                    }
                };
                post.attachments.push( attachmentMap[ attachment.expanded_url ] );
              }
            });
          }

          if (tweet.entities && tweet.entities.media) {
            tweet.entities.media.forEach(function(attachment) {
              if ( Object.keys( attachmentMap ).indexOf( attachment.expanded_url ) == -1) {
                attachmentMap[ attachment.expanded_url ] = {
                    url: attachment.expanded_url
                  , title: attachment.display_url
                  , description: tweet.text
                  , image: {
                      url: attachment.media_url_https
                    }
                };
                post.attachments.push( attachmentMap[ attachment.expanded_url ] );
              }
            });
          }

          if (tweet.entities && tweet.entities.hashtags) {
            post.tags = _.union( post.tags , tweet.entities.hashtags.map(function(hashtag) {
              return hashtag.text.toLowerCase();
            }));
          }

          if (!post.updated || new Date(tweet.created_at) > post.updated) {
            post.title = tweet.text.split(' ').slice(0, 6).join(' ') + '...';
            post.content = textParser.autoLink( tweet.text , {
                hashtagClass      : 'hashtag'
              , hashtagUrlBase    : "/s/"
              , cashtagClass      : 'cashtag'
              , cashtagUrlBase    : "/s/"
              , listClass         : 'autolinked-list'
              , usernameClass     : 'autolinked-username'
              , usernameUrlBase   : "http://twitter.com/"
              , listUrlBase       : "/list/"
              , invisibleTagAttrs : "style='position:absolute;left:-9999px;'"
              , suppressNoFollow  : true
              , targetBlank       : false
            });
            post.created   = new Date(tweet.created_at);
            post.published = new Date(tweet.created_at);
            post.updated   = new Date(tweet.created_at);
          }

          post.save(function(err) {
            if (err) { console.log(err); }
            cascadeComplete(err);
          });
        },
        function(cascadeComplete) {

          if (!tweet.inReplyTo) {
            console.log('tweet has no inReplyTo');
            return cascadeComplete(null);
          } else {
            console.log(tweet.inReplyTo);
            console.log('^ tweet has inReplyTo');
          }

          //process.exit();

          var reply = post; // rename to reply so we can copy the Google code, maybe DRY it later
          self.getPost('twitter', tweet.inReplyTo.uri , tweet.inReplyTo , function(err, parent) {
            // begin DRY-able
            var replyMap = {};
            parent.replies.forEach(function(reply) {
              replyMap[ reply._post ] = reply;
            });
            if (Object.keys( replyMap ).indexOf( post._id.toString() ) == -1) {
              parent.replies.push({
                  _author: person._id
                , _post: post._id
              });
            }
            parent.save(function(err) {
              if (err) { console.log(err); return cascadeComplete(err); }


              post._author = person._id;
              post._parent = parent._id;

              console.log(post);
              console.log('^- modified post')

              post.save(function(err) {
                if (err) { console.log(err); return cascadeComplete(err); }
                cascadeComplete(err);
              });
            });

            // end DRY-able
          });
        }
      ], function(err, results) {
        tweetComplete(err, results);
      });
    });
  });
};
Engine.prototype.processGooglePost = function(activity, activityComplete) {
  var self = this;
  self.getPerson( 'google' , activity.actor.id , activity.actor , function(err, person) {
    var urlKey = activity.url;
    self.getPost( 'google' , urlKey , activity , function(err, post) {
      async.waterfall([
        function(cascadeComplete) {
          person.save(function(err) {
            if (err) { console.log('error saving person: ' + err); }
            cascadeComplete(err);
          });
        },
        function(cascadeComplete) {
          post._author = person._id;

          // Only update the contents / details of the post if it has NOT been updated internally
          if (!post.updated || new Date(activity.updated) > post.updated) {
            console.log('activity updated greater than post updated.')
            post.title      = (activity.title) ? activity.title : activity.object.content.substring(0, 35);
            post.published  = new Date( activity.published );
            post.updated    = new Date( activity.updated );
            post.content    = activity.object.content;
          }

          if (activity.object && activity.object.attachments) {
            post.attachments = activity.object.attachments.map(function(attachment) {
              return {
                  url: attachment.url
                , title: attachment.displayName
                , description: attachment.content
                , type: (attachment.objectType == 'video') ? 'video' : (attachment.objectType == 'photo') ? 'image' : undefined
                , image: {
                    url: (attachment.image) ? attachment.image.url : undefined
                  }
              };
            });

            // use the first attachment
            var attachment = activity.object.attachments[0];

            // parse photo albums?
            if (!post.title && attachment.objectType == 'album') {
              post.title = attachment.displayName;
            }

            // notes?  somehow tweets are posted?
            if (!post.title && !post.content && activity.object.objectType == 'note') {
              post.title = attachment.content;
              post.content = attachment.content;
            }

            console.log(attachment)

          }

          post.save(function(err) {
            cascadeComplete(err);
          });

        }
      ], function(err, results) {

        if (err) { 
          console.log(err);
        }

        activityComplete(err, results);
      });
    });
  });
};
Engine.prototype.processGoogleComment = function(comment, commentComplete) {
  var self = this;
  self.getPerson( 'google' , comment.actor.id , comment.actor , function(err, person) {
    var urlKey = comment.selfLink;
    self.getPost( 'google' , urlKey , comment , function(err, post) {

      // get parent
      self.getPost( 'google' , comment.inReplyTo[0].url , comment , function(err, parent) {
        async.waterfall([
          function(cascadeComplete) {
            person.save(function(err) {
              if (err) { console.log('error saving person: ' + err); }
              cascadeComplete(err);
            });
          },
          function(cascadeComplete) {
            post._author = person._id;
            post._parent = parent._id;

            post.title = comment.object.content.split(' ').slice(0, 6).join(' ') + '...';
            post.content = comment.object.content;
            post.created = new Date( comment.published );
            post.published = new Date( comment.published );
            post.updated = new Date( comment.updated );

            post.save(function(err) {
              if (err) { console.log(err); }
              cascadeComplete(err);
            });

          },
          function(cascadeComplete) {
            var replyMap = {};
            parent.replies.forEach(function(reply) {
              replyMap[ reply._post ] = reply;
            });
            if (Object.keys( replyMap ).indexOf( post._id.toString() ) == -1) {
              parent.replies.push({
                  _author: person._id
                , _post: post._id
              });
            }
            parent.save(function(err) {
              if (err) { console.log(err); }
              cascadeComplete(err);
            });
          }
        ], function(err, results) {
          commentComplete(err, results);
        });
      });
    });
  });
};
Engine.prototype.getPost = function( source, id, data, postCallback) {

  if (id.indexOf('https://graph.facebook.com/') === 0) {
    id = id.replace(/https:\/\/graph.facebook.com\/(\d*)_(\d*)/ig, 'https://www.facebook.com/$1/posts/$2');
  }

  Post.findOne({ 'resources.uri': id }).exec( function(err, post) {
    if (!post) { var post = new Post({}); }

    var resourceMap = {};
    post.resources.forEach(function(resource) {
      resourceMap[ resource.uri ] = resource;
    });
    if (Object.keys( resourceMap ).indexOf( id ) == -1) {
      post.resources.push({
          provider: source
        , uri: id
        , data: data // TODO: merge with existing records
      });
    }

    postCallback(err, post);
  } );
};
Engine.prototype.getPerson = function( source, id, data, personCallback) {
  var query = {};
  var sourceKey = 'profiles.'+ source +'.id';
  query[ sourceKey ] = id;

  Person.findOne( query ).exec( function(err, person) {
    if (!person) { var person = new Person({}); }


    if (!person.username) {
      switch (source) {
        case 'twitter':
          person.username = data.screen_name;
        break;
        case 'facebook':
          person.username = data.name;
        break;
        case 'google':
          person.username = data.displayName;
        break;
      }
    }

    var sourceMap = {};
    person.profiles[ source ].forEach(function(profile) {
      sourceMap[ profile.id ] = profile;
    });
    if (Object.keys( sourceMap ).indexOf( id ) == -1) {
      person.profiles[ source ].push({
          id: id
        , data: data
      });
    }

    personCallback(err, person);

  });
}

Engine.prototype.sync = function() {

  if (config.providers.twitter.enabled) {
    this.app.jobs.create('multi', {
      type: 'sync:twitter'
    }).save();
  }

  if (config.providers.google.enabled) {
    this.app.jobs.create('multi', {
      type: 'sync:google'
    }).save();
  }

  if (config.providers.facebook.enabled) {
    this.app.jobs.create('multi', {
      type: 'sync:facebook'
    }).save();
  }

  if (config.providers.custom.enabled) {
    this.app.jobs.create('multi', {
      type: 'sync:custom'
    }).save();
  }

  // sync local markdown files
  /*/ this.providers.local.getPosts( function(err, _posts) {
    async.series( _posts.map(function(_post) {
      return function(complete) {
        Post.findOne({ 'remotes.local.file': _post.file }).exec(function(err, post) {
          if (!post) { var post = new Post({}); }

          console.log(_post.markup);

          post.remotes.local.file = _post.file;
          post.title      = (post.title) ? post.title : (_post.title) ? _post.title : _post.slug;
          post.published  = _post.date;
          post.content    = (post.content) ? post.content : _post.content;
          post.markup     = _post.markup;

          post.save(function(err) {
            if (err) { console.log(err); }
            complete(err, post);
          });

        });
      };
    }) , function(err, results) {
      console.log('posts saved!!!');
      console.log(err);
      console.log(results);
    });
    
  } ); /**/

}

module.exports = Engine;