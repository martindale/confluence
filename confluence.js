/*/ require('debug-trace')({
  always: true
}); /**/
var database = require('./db')
  , express = require('express')
  , app = express()
  , kue = require('kue')
  , rest = require('restler')
  , mongoose = require('mongoose')
  , flashify = require('flashify')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , GitHubStrategy = require('passport-github').Strategy
  , TwitterStrategy = require('passport-twitter')
  , mongooseRedisCache = require('mongoose-redis-cache')
  , RedisStore = require('connect-redis')(express)
  , sessionStore = new RedisStore()
  , marked = require('marked');

// global config
config = require('./config');
// some common libs
_     = require('underscore');
async = require('async');

var Engine = require('./lib/engine');

var Google   = require('./lib/google');
var Facebook = require('./lib/facebook');
var Twitter  = require('./lib/twitter');
var Local    = require('./lib/local');

Person       = require('./models/Person').Person;
Post         = require('./models/Post').Post;
Page         = require('./models/Page').Page;

app.controllers = {
    posts:  require('./controllers/posts')
  , pages:  require('./controllers/pages')
  , admin:  require('./controllers/admin')
  , people: require('./controllers/people')
};
app.jobs   = kue.createQueue();

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('strict routing', true);
app.marked = require('marked').setOptions({
    langPrefix: 'prettyprint lang-'
  , breaks: true
  , smartypants: true
});

app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.cookieParser( config.sessions.key ));
app.use(express.bodyParser());
app.use(express.methodOverride())
app.use(express.errorHandler());
app.use(express.session({
    key: config.sessions.name
  , secret: config.sessions.key
  , cookie: {
      domain: config.sessions.domain
    }
  , store: sessionStore
}));
app.use(passport.initialize());
app.use(passport.session());
//app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

passport.use(Person.createStrategy());
passport.serializeUser(Person.serializeUser());
passport.deserializeUser(Person.deserializeUser());

app.use(function(req, res, next) {

  // if request ends in trailing slash, redirect to new location without it
  if (req.path.length > 1 && req.path.substring(req.path.length - 1) == '/') {
    // strip trailing slash
    var url = req.path.substring(0, req.path.length - 1);

    // check for query string
    if (req.originalUrl.indexOf('?') > 1) {
      // append query string
      url += req.originalUrl.substring(req.originalUrl.indexOf('?'), req.originalUrl.length);
    }
    return res.redirect(301, url);
  }

  req.app.locals.user = req.user;
  next();
});
app.use( flashify );

app.locals.pretty   = true;
app.locals.moment   = require('moment');
app.locals.markdown = app.marked;

//mongooseRedisCache(mongoose);

app.get('/register',  app.controllers.people.registrationForm );
app.get('/login',     app.controllers.people.loginForm );
app.post('/register', app.controllers.people.register );
app.post('/login',    passport.authenticate('local', {
                          failureRedirect: '/login'
                        , failureFlash: true
                      }), app.controllers.people.login );
app.get('/logout',    app.controllers.people.logout );

var engine = new Engine( app );
engine.init('martindale', function() {
  engine.sync();
});
app.engine = engine;

setInterval(function() {
  console.log('synchronizing...');
  engine.sync();
}, 60 * 60 * 1000 );

app.get('/', app.controllers.posts.index );
app.get('/feed', function(req, res, next) {
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
    res.render('rss', {
        name: config.site.name
      , link: config.site.url
      , tagline: config.site.tagline
      , posts: results[1]
    });
  });
});
app.get('/stream:restOfPath?', function(req, res, next) {
  var path = req.param('restOfPath') || '';
  res.redirect('/' + path );
});

app.post('/admin/posts/merge', app.controllers.posts.merge );
app.get('/admin', app.controllers.admin.index );
app.post('/admin/queue', app.controllers.admin.schedule );

app.get('/write', function(req, res, next) {
  res.render('posts-create');
});
app.post('/posts', function(req, res, next) {
  var post = new Post({
      title: req.param('title')
    , content: req.param('content')
    , markup: 'markdown'
  });
  post.save(function(err) {
    res.format({
      json: function() {
        res.send({
            status: 'succes'
          , message: 'Post created successfully.'
        });
      },
      html: function() {
        res.redirect( post.permalink );
      }
    });
  });
});
app.get('/posts/:postID/edit', function(req, res, next) {
  Post.findOne({ _id: req.param('postID') }).exec(function(err, post) {
    if (err || !post) { return next(); }
    res.render('posts-edit', {
      post: post
    });
  });
});
app.post('/posts/:postID', function(req, res, next) {
  Post.findOne({ _id: req.param('postID') }).exec(function(err, post) {
    if (err || !post) { return next(); }
    post.title   = (req.param('title')) ? req.param('title') : post.title;
    post.slug    = (req.param('slug')) ? req.param('slug') : post.slug;
    post.content = (req.param('content')) ? req.param('content') : post.content;
    post.updated = new Date();

    console.log(req.param('featured'))

    post.featured = (req.param('featured')) ? req.param('featured') : post.featured;

    post.save(function(err) {
      res.redirect( post.permalink );
    });
  });
});

app.get('/:pageSlug', app.controllers.pages.single );

app.get('/posts/:postID', function(req, res, next) {
  Post.findOne({ _id: req.param('postID') }).exec(function(err, post) {
    if (!post) { return next(); }
    res.redirect( post.permalink );
  });
});
app.get('/providers/:provider', function(req, res, next) {
  var limit = 20;

  switch (req.param('provider')) {
    default: return next(); break;
    case 'twitter':
    case 'facebook':
    case 'google':
      var query = req.param('provider');
    break;
  }

  Post.paginate( query , {
      limit: limit
    , skip: (req.param('page')) ? (req.param('page') * limit) - limit : 0
    , populate: '_author'
  }, function(err, posts) {
    // TODO: switch to provider template
    res.render('index', {
        query: req.param('tag')
      , posts: posts
    });
  });
});

app.get('/:year/:month/:day/:postSlug', app.controllers.posts.single );

app.get('/s/:query', function(req, res, next) {
  Post.textSearch( req.param('query') , function (err, output) {
    if (err) { console.log(err); }
    res.render('search', {
        query: req.param('query')
      , output: output
      , posts: output.results.map(function(x) { return x.obj; })
    });
  });
});
app.get('/tags/:tag', function(req, res, next) {
  var limit = 20;

  Post.paginate({ tags: req.param('tag') }, {
      limit: limit
    , skip: (req.param('page')) ? (req.param('page') * limit) - limit : 0
    , populate: '_author'
  }, function(err, posts) {
    // TODO: switch to tag template
    res.render('search', {
        query: req.param('tag')
      , posts: posts
    });
  });
});

app.get('/:usernameSlug', app.controllers.people.profile );

app.redirects = {};
app.get('*', function(req, res) {
  if (Object.keys( app.redirects ).indexOf( req.path ) >= 0) {
    return res.redirect( app.redirects[ req.path ] );
  }

  res.status(404).render('404', {
    req: req
  });
});

app.listen( config.http.port );
