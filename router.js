const axios = require('axios');
const { MongoClient } = require('mongodb')


const url = 'mongodb://localhost:27017';
const client = new MongoClient(url);
const dbName = 'authyDB';
const db = client.db(dbName);
const users = db.collection('users');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_URL = 'https://github.com/login/oauth/access_token';

// const registerOauthGeneric = async (req, res, userObject) => {
//   await client.connect();
//   const db = client.db(dbName);
//   const users = db.collection('users');
//   try {
//     await users.insertOne(userObject);
//     res.redirect('http://localhost:5173')
//   }
//   catch (err) {
//     console.log('error occurred:', err);
//     res.status(500).send('an error has occurred');
//   }
//   finally {
//     client.close()
//   }
// }

const register = async (req, res, next) => {
  const { email, password } = req.body;
  await client.connect();
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
  const { oauth_id, curr_email, name, bio, phone, email, password, picture_url } = req.body;
  await client.connect();
  try {
    if (oauth_id) {
      const userResults = await users.findOneAndUpdate(
        { oauth_id: oauth_id },
        { $set: { name: name, bio: bio, phone: phone, email: email, password: password, picture_url: picture_url } },
        { returnDocument: 'after', upsert: true }
      );
      res.json(userResults);
    }
    else {
      const userResults = await users.findOneAndUpdate(
        { email: curr_email },
        { $set: { name: name, bio: bio, phone: phone, email: email, password: password, picture_url: picture_url } },
        { returnDocument: 'after', upsert: true }
      );
      res.json(userResults);
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

const oauthGithub = async (req, res, next) => {
  const access_token = await axios.post(`${GITHUB_URL}?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}&code=${req.query.code}`,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  )
    .then((response) => {
      if (typeof response.data != 'string') {
        throw 'github actually returned a json format, update ur code'
      }
      const token = response.data.slice(
        response.data.indexOf('=') + 1, response.data.indexOf('&')
      )
      return token
    })
    .catch((err) => {
      console.log('error:', err);
      res.status(500).send('an error has occurred');
    })
  // console.log('token ready:', access_token);
  const user_data = await axios.get('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    }
  })
    .then((response) => {
      // console.log(response.data)
      const newGithubUser = {
        oauth_id: `github=${response.data.id}`,
        email: '',
        password: '',
        bio: response.data.bio,
        name: response.data.name,
        phone: '',
        picture_url: response.data.avatar_url,
      }
      return newGithubUser
    })
    .catch((err) => {
      console.log('error:', err);
      res.status(500).send('an error has occurred');
    })
  // console.log('github user data:', user_data);
  try {
    await client.connect();
    const findResult = await users.find({ oauth_id: user_data.oauth_id }).toArray();
    if (!findResult[0]) {
      await users.insertOne(user_data);
      res.json(user_data);
    }
    else {
      res.json(findResult[0]);
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

module.exports = {
  register,
  login,
  editProfile,
  oauthGithub,
}