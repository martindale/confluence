module.exports = {
  registrationForm: function(req, res, next) {
    res.render('register');
  },
  loginForm: function(req, res, next) {
    res.render('login');
  },
  register: function(req, res) {
    var newUser = {
        username: req.body.username
    };

    Person.register( new Person( newUser ) , req.body.password, function(err, user) {
      req.login(user, function(err) {
        res.redirect('/');
      });
    });
  },
  login: function(req, res) {
    res.redirect('/');
  }, 
  logout: function(req, res) {
    req.logout();
    res.redirect('/');
  },
  profile: function(req, res, next) {
    var query = {};
    var limit = 20;

    Person.findOne({ slug: req.param('usernameSlug') }).exec(function(err, person) {
      if (err) { console.log(err); }
      if (!person) { return next(); }

      // only show one author
      query._author = person._id;

      Post.paginate( query , {
          limit: 5
        , skip: (req.param('page')) ? (req.param('page') * limit) - limit : 0
        , populate: '_author _parent replies._post replies._author'
      } , function(err, results) {
        res.render('person', {
            person: person
          , posts: results[1].map(function(post) {
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

    });

  }
}
