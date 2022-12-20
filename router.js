const path = require('path')
const fs = require('fs')
// const http = require('http')
// const url = require('url')
const axios = require('axios')
const { google } = require('googleapis')
const people = google.people('v1')
const { MongoClient } = require('mongodb')

const db_url = 'mongodb://localhost:27017';
const client = new MongoClient(db_url);
const dbName = 'authyDB';
const db = client.db(dbName);
const users = db.collection('users');
const REDIRECT_URI = 'http://localhost:5173';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_URL = 'https://github.com/login/oauth/access_token';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const serviceKey = path.join(__dirname, './config/keys.json');
if (!fs.existsSync(serviceKey)) {
  const serviceKeyCut = require('./config/keyscut.json');
  const serviceKeyJoined = {
    ...serviceKeyCut,
    "private_key_id": process.env.GOOGLE_PRIV_ID,
    "private_key": process.env.GOOGLE_PRIV_KEY.replace(/\\n/gm, '\n')
  };
  fs.writeFileSync(serviceKey, JSON.stringify(serviceKeyJoined));
}

const googleOauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);
google.options({ auth: googleOauth2Client });

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
    console.error(err);
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
    console.error(err);
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
    console.error(err);
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
      console.error(err);
      res.status(500).send('an error has occurred');
    })
  // console.log('token ready:', access_token);
  const githubUser = await axios.get('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    }
  })
    .then((response) => {
      // console.log(response.data)
      const ghubUser = {
        oauth_id: `github=${response.data.id}`,
        email: '',
        password: '',
        phone: '',
        bio: response.data.bio,
        name: response.data.name,
        picture_url: response.data.avatar_url,
      }
      return ghubUser
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('an error has occurred');
    })
  // console.log('github user data:', githubUser);
  try {
    await client.connect();
    const findResult = await users.find({ oauth_id: githubUser.oauth_id }).toArray();
    if (!findResult[0]) {
      await users.insertOne(githubUser);
      res.json(githubUser);
    }
    else {
      res.json(findResult[0]);
    }
  }
  catch (err) {
    console.error(err);
    res.status(500).send('an error has occurred');
  }
  finally {
    client.close()
  }
}

const oauthGoogle = async (req, res) => {

  const { code } = req.body;
  let { tokens } = await googleOauth2Client.getToken(code);
  googleOauth2Client.setCredentials(tokens);
  const userDataRaw = await people.people.get({
    resourceName: 'people/me',
    personFields: 'names,biographies,photos',
  });
  const googleId = userDataRaw.data.resourceName;
  const googleUser = {
    oauth_id: `google=${googleId.slice(googleId.indexOf('/') + 1)}`,
    email: '',
    password: '',
    phone: '',
    ...(userDataRaw.data.biographies ? { bio: userDataRaw.data.biographies[0].value } : { bio: '' }),
    ...(userDataRaw.data.names ? { name: userDataRaw.data.names[0].displayName } : { name: '' }),
    ...(userDataRaw.data.photos ? { picture_url: userDataRaw.data.photos[0].url } : { picture_url: '' }),
  }
  // const reponseObj = {
  //   tokens: tokens,
  //   userData: googleUser
  // };
  try {
    await client.connect();
    const findResult = await users.find({ oauth_id: googleUser.oauth_id }).toArray();
    if (!findResult[0]) {
      await users.insertOne(googleUser);
      res.json(googleUser);
    }
    else {
      res.json(findResult[0]);
    }

  } 
  catch (err) {
    console.error(err)
    res.status(400).send(err)
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
  oauthGoogle
}