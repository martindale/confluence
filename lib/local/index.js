var fs = require('fs')
  , fm = require('front-matter')
  , async = require('async');

function Local(config) {
  this.folders = {
      posts:  config.posts
    , drafts: config.drafts
  }
};

Local.prototype.getDrafts = function(done) {
  var self = this;
};

Local.prototype.getPosts = function(done) {
  var self = this;
  fs.readdir( self.folders.posts , function(err, files) {
    async.map( files , function(file, cb) {
      fs.readFile( self.folders.posts + '/' + file , 'utf8' , function(err, content) {

        var data = fm(content);

        console.log('attributed time: ' + data.attributes.time);
        var date = (data.attributes.time) ? new Date(data.attributes.time) : new Date( file.replace(/(^\d{4}-\d{2}-\d{2}-)(.*)/, '$1').replace(/-$/, '') );

        var markup = file.slice( file.lastIndexOf('.') + 1 );
        var slug = file.replace(/(^\d{4}-\d{2}-\d{2}-)(.*)\.(md|markdown|jade)$/, '$2');

        switch (markup.toLowerCase()) {
          case 'md':
          case 'markdown':
            markup = 'markdown';
          break;
          case 'jade':
            markup = 'jade';
          break;
        }

        cb(err, {
            file: file
          , title: data.attributes.title
          , slug: slug
          , date: date
          , content: data.body
          , markup: markup
        });
      } );
    }, function(err, posts) {
      done(err, posts);
    });
  });

};

module.exports = Local;