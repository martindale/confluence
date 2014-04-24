var kue = require('kue');
kue.app.set('title', 'Confluence Kue Monitor');
kue.app.listen(12001);