var _ = require('underscore');
var async = require('async');

module.exports = {
  index: function(req, res, next) {

    var query = {};
    // only show one author
    query._author = req.app.engine._author;
    query._parent = { $exists: false };

    Post.find( query ).sort('-published').populate('_author').exec(function(err, posts) {

      var linkMap = {}
        , postMap = {};
      posts.forEach(function(post) {
        postMap[ post._id ] = post;
        post.attachments.forEach(function(attachment) {
          linkMap[ attachment.url ] = (linkMap[ attachment.url ]) ? _.union( linkMap[ attachment.url ] , [ post._id ] ) : [ post._id ];
        });
      });

      var merges = [];
      Object.keys( linkMap ).forEach(function( link ) {
        if ( linkMap[ link ].length > 1 ) {
          merges.push( linkMap[ link ] );
        }
      });

      var candidates = [];
      async.parallel( merges.map(function(mergeIDs) {
        return function(mergePopulated) {
          Post.find({ _id: { $in: mergeIDs }}).exec(function(err, mergePosts) {
            candidates.push( mergePosts );
            mergePopulated(null, mergePosts);
          });
        };
      }), function(err, results) {
        res.render('admin', {
            posts: posts
          , merges: candidates
        });
      });

    });
  },
  schedule: function(req, res, next) {
    console.log(req.param('type'));
    req.app.jobs.create('multi', {
      type: req.param('type')
    }).save();
    res.send({ status: 'success', message: 'job type "' + req.param('type') + '" queued successfully' });
  }
}