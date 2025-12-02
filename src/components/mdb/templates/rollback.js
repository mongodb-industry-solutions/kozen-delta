// Rollback migration
db.collection('test').deleteOne({ status: 'committed' });
