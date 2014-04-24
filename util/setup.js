var db = requirE('../db');
Person = require('../models/Person');

Person.update({ username: 'martindale' }, {
  $set: {
    profiles: {
        google: [
          { id: '112353210404102902472' }
        ]
      , twitter: [
          { id: '8289702', username: 'martindale' }
        ]
      , facebook: [
          { id: '1567740004' }
        ]
    }
  }
}, function(err, affected) {
  if (err) { console.log(err); }
  console.log('updated ' + affected + ' records.');
});