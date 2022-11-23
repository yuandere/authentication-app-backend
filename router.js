const { MongoClient } = require('mongodb')

const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'authyDB';


// const main = async() => {
//   await client.connect();
//   const db = client.db(dbName);
//   const users = db.collection('users');
//   const findResult = await users.find({}).toArray();
//   return findResult
// }

const register = async(req, res, next) => {
  const { email, password } = req.body;
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  try {
    const findResult = await users.find({ email: email }).toArray();
    if (!findResult[0]) {
      const insert = { email: email, password: password };
      await users.insertOne(insert);
      res.status(201).send('new user added')
    } else {
      res.status(200).send('email already in use!')
    }
  }
  catch (err) {
    console.log('error occurred:', err);
  }
  finally {
    client.close()
  }
}

const login = (req, res) => {

  main()
    .then(console.log)
    .catch(console.error)
    .finally(() => client.close());

  res.status(200).send('login successful')
}

module.exports = {
  register,
  login,
}