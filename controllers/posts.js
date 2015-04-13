var _ = require('underscore');
var moment = require('moment');

module.exports = {
  index: function(req, res, next) {
    var limit = 20;
    var query = {};
    // only show one author
    query._author = req.app.engine._author;
    query._parent = { $exists: false };

    Post.paginate( query , {
        limit: limit
      , skip: (req.param('page')) ? (req.param('page') * limit) - limit : 0
      , populate: '_author'
    } , function(err, results) {
      res.render('index', {
          posts: results[1].map(function(post) {
            switch (post.markup) {
              case 'markdown':
                post.content = app.marked( post.content );
              break;
            }
            return post;
          })
        , pagination: {
              page: parseInt( req.param('page') || 1 )
            , total: parseInt(results[2])
            , limit: parseInt(results[0].limit)
            , count: Math.ceil(results[2] / results[0].limit)
          }
      });
    });

  },
  single: function(req, res, next) {
    console.log('request for ' + req.path + ' received')

    var requestedDate = [ req.params.year , req.params.month , req.params.day ].join('/');
    var date = new Date( requestedDate );
    var correctString = moment( date ).format('YYYY/MM/DD');

    if (requestedDate !== correctString) return res.redirect( '/' + correctString + '/' + req.params.postSlug );

    Post.findOne({
        $or: [
            { slug: req.param('postSlug') }
          , { slugs: req.param('postSlug') }
        ]
    }).populate('_author _parent replies._post replies._author').exec(function(err, post) {
      if (err || !post) { return next(); }

      if (post.slug != req.param('postSlug')) { return res.redirect( post.permalink ); }

      post.replies.sort(function(a, b) {
        return a['_post']['published'] - b['_post']['published'];
      });

      res.format({
        json: function() {
          res.send(post);
        },
        html: function() {
          if (post.markup == 'markdown') {
            post.content = app.marked( post.content );
          }

          res.render('post', {
            post: post
          });
        }
      });
    });
  },
  merge: function(req, res, next) {
    var mergeablePostQuery = { _id: { $in: req.param('postIDs') } };
    Post.find( mergeablePostQuery ).sort('published').exec(function(err, posts) {


      var post = new Post();

      // WARNING: the sort order is important here. see above sort by 'published'
      posts.forEach(function(merge) {
        // prefer content from the first post written on the subject
        post.title   = (post.title)   ? post.title   : merge.title;
        post.content = (post.content) ? post.content : merge.content;
        post.markup  = (post.markup)  ? post.markup  : merge.markup;

        post.created   = (post.created   <= merge.created)   ? post.created   : merge.created;
        post.published = (post.published <= merge.published) ? post.published : merge.published;

        post._parent = (post._parent) ? post._parent : merge._parent; // TODO: track multiple parents?
        post._author = (post._author) ? post._author : merge._author;

        post.visibility = 'public';

        // mergeables
        post.resources =   _.union( post.resources , merge.resources );
        post.replies =     _.union( post.replies , merge.replies );
        post.attachments = _.union( post.attachments , merge.attachments );
        post.slugs =       _.union( post.slugs , merge.slugs );
        post.tags =        _.union( post.tags , merge.tags );

      });

      // finally, mark post as having changed
      post.updated   = new Date();

      post.save(function(err) {
        if (err) { console.log(err); return next(); }

        Post.remove( mergeablePostQuery ).exec(function(err) {
          if (err) { console.log(err); }
          res.send({
              status: 'success'
            , posts: posts
            , post: post
          });
        });
      });
    });

    
  }
}
