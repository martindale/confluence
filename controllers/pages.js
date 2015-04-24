module.exports = {
  single: function(req, res, next) {
    Page.findOne({ slug: req.param('pageSlug') }).exec(function(err, page) {
      if (err || !page) { return next(); }
      res.format({
        json: function() {
          res.send( page );
        },
        html: function() {
          res.render('page', {
            page: page
          });
        }
      })
    });
  },
  editForm: function(req, res, next) {
    Page.findOne({ slug: req.param('pageSlug') }).exec(function(err, page) {
      if (err || !page) return next();
      res.render('pages-edit', {
        page: page
      });
    });
  }
  },
  edit: function(req, res, next) {
    Page.findOne({ slug: req.param('pageSlug') }).exec(function(err, page) {
      if (err || !page) return next();
      page.content = req.param('content') || page.content;
      page.save(function(err) {
        res.redirect('/' + page.slug );
      });
    });
  }
}
