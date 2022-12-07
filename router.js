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

const register = async (req, res, next) => {
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
      res.status(403).send('email already in use!')
    }
  }
  catch (err) {
    console.log('error occurred:', err);
    res.status(500).send('an error has occurred');
  }
  finally {
    client.close()
  }
}

const login = async (req, res, next) => {
  const { email, password } = req.body;
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  try {
    const findResult = await users.find({ email: email, password: password }).toArray();
    if (findResult[0]) {
      const userResults = {
        name: findResult[0].name,
        bio: findResult[0].bio,
        phone: findResult[0].phone,
        email: findResult[0].email,
        password: findResult[0].password,
        picture_url: findResult[0].picture_url,
      }
      res.json(userResults);
    } else {
      res.status(401).send('incorrect email/password combination')
    }
  }
  catch (err) {
    console.log('error occurred:', err);
    res.status(500).send('an error has occurred');
  }
  finally {
    client.close()
  }
}

const editProfile = async (req, res, next) => {
  const { curr_email, name, bio, phone, email, password, picture_url } = req.body;

  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');
  try {
    const userResults = await users.findOneAndUpdate(
      { email: curr_email },
      { $set: { name: name, bio: bio, phone: phone, email: email, password: password, picture_url: picture_url } },
      { returnDocument: 'after', upsert: true }
    );
    res.json(userResults);
  }
  catch (err) {
    console.log('error occurred:', err);
    res.status(500).send('an error has occurred');
  }
  finally {
    client.close()
  }
}

module.exports = {
  register,
  login,
  editProfile
}