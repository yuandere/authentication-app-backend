const path = require('path')
const fs = require('fs')
const axios = require('axios')
const qs = require('qs')
const { google } = require('googleapis')
const people = google.people('v1')
const { MongoClient, ServerApiVersion } = require('mongodb')
const bcrypt = require('bcrypt')

// const db_uri = 'mongodb://localhost:27017';
// const client = new MongoClient(db_uri);
const db_uri = `mongodb+srv://authyapp:${process.env.MONGO_PASSWORD}@cluster0.oeadnfp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(db_uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const dbName = 'authyDB';
const db = client.db(dbName);
const users = db.collection('users');

const REDIRECT_URI = 'https://lucent-mermaid-ff4214.netlify.app/';
// const REDIRECT_URL_NGROK = 'https://3206-104-59-98-29.ngrok.io';
const REDIRECT_URL_NGROK = 'https://lucent-mermaid-ff4214.netlify.app/';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID;
const FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET;
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;

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

const dbOauth = async (res, userObject) => {
  try {
    await client.connect();
    const findResult = await users.find({ oauth_id: userObject.oauth_id }).toArray();
    if (!findResult[0]) {
      const newUser = {
        ...userObject,
        new_user: true
      }
      await users.insertOne(newUser);
      res.json(newUser);
    }
    else {
      res.json(findResult[0]);
    }
  }
  catch (err) {
    console.error(err);
    res.status(500).send('database error!');
  }
  finally {
    client.close()
  }
}

const register = async (req, res) => {
  const email = req.body.email;
  const password = await bcrypt.hash(req.body.password, 12);
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

const login = async (req, res) => {
  const { email, password } = req.body;
  await client.connect();
  try {
    const findResult = await users.find({ email: email }).toArray();
    if (findResult[0]) {
      const userResults = {
        name: findResult[0].name,
        bio: findResult[0].bio,
        phone: findResult[0].phone,
        email: findResult[0].email,
        password: findResult[0].password,
        picture_url: findResult[0].picture_url,
        new_user: false,
        oauth_login: false,
      }
      const match = await bcrypt.compare(password, userResults.password);
      if (match) {
        userResults.password = '*'.repeat(password.length);
        res.json(userResults);
      }
      else {
        res.status(401).send('That email/password combination was not found!')
      }
    } else {
      res.status(401).send('That email/password combination was not found!')
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

const editProfile = async (req, res) => {
  const { oauth_id, curr_email, name, bio, phone, email, picture_url } = req.body;
  const password = await bcrypt.hash(req.body.password, 12);
  await client.connect();
  try {
    if (oauth_id) {
      const userResults = await users.findOneAndUpdate(
        { oauth_id: oauth_id },
        { $set: { name: name, bio: bio, phone: phone, email: email, password: password, picture_url: picture_url, new_user: false } },
        { returnDocument: 'after' }
      );
      userResults.value.password = '*'.repeat(req.body.password.length);
      res.json(userResults.value);
    }
    else {
      const userResults = await users.findOneAndUpdate(
        { email: curr_email },
        { $set: { name: name, bio: bio, phone: phone, email: email, password: password, picture_url: picture_url, new_user: false } },
        { returnDocument: 'after' }
      );
      userResults.value.password = '*'.repeat(req.body.password.length);
      res.json(userResults.value);
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

const deleteAccount = async (req, res) => {
  const { email, oauth_id } = req.body;
  const search = {
    ...(oauth_id ? { oauth_id: oauth_id } : { email: email })
  }
  await client.connect();
  try {
    await users.deleteOne(search);
    res.status(200).send('account deleted');
  }
  catch (err) {
    console.error(err);
    res.status(500).send('an error has occurred');
  }
  finally {
    client.close()
  }
}

const oauthGithub = async (req, res) => {
  const access_token = await axios.post(`https://github.com/login/oauth/access_token?client_id=${GITHUB_CLIENT_ID}&client_secret=${GITHUB_CLIENT_SECRET}&code=${req.query.code}`,
    {
      headers: {
        Accept: 'application/json'
      }
    }
  )
    .then((response) => {
      if (typeof response.data != 'string') {
        throw `i realized axios' alias method doesn't set request headers properly but this works fine too`
      }
      const token = response.data.slice(
        response.data.indexOf('=') + 1, response.data.indexOf('&')
      )
      return token
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('github token request error');
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
        oauth_login: true,
      }
      return ghubUser
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('github user info request error');
    })
  dbOauth(res, githubUser);
}

const oauthGoogle = async (req, res) => {
  const code = req.query.code;
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
    oauth_login: true,
  }
  // const reponseObj = {
  //   tokens: tokens,
  //   userData: googleUser
  // };
  dbOauth(res, googleUser);
}

const oauthFacebook = async (req, res) => {
  const access_token = await axios.get
  // `https://graph.facebook.com/v15.0/oauth/access_token?client_id=${FACEBOOK_CLIENT_ID}&redirect_uri=${REDIRECT_URI + '/'}&client_secret=${FACEBOOK_CLIENT_SECRET}&code=${req.query.code}`
    (`https://graph.facebook.com/v15.0/oauth/access_token?client_id=${FACEBOOK_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${FACEBOOK_CLIENT_SECRET}&code=${req.query.code}`)
    .then((response) => {
      return response.data.access_token
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('fb token request error');
    })
  // console.log('token ready:', access_token);
  const facebookId = await axios.get
    (`http://graph.facebook.com/debug_token?input_token=${access_token}&access_token=${FACEBOOK_CLIENT_ID}|${FACEBOOK_CLIENT_SECRET}`)
    .then((response) => {
      return response.data.data.user_id
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('fb user id request error');
    })
  // console.log('fb ID found:', facebookId);
  const facebookUser = await axios.get
    (`http://graph.facebook.com/v15.0/${facebookId}?fields=name,picture&access_token=${access_token}`)
    .then((response) => {
      const fbUser = {
        oauth_id: `facebook=${facebookId}`,
        email: '',
        password: '',
        phone: '',
        bio: '',
        ...(response.data.name ? { name: response.data.name } : { name: '' }),
        ...(response.data.picture ? { picture_url: response.data.picture.data.url } : { picture_url: '' }),
        oauth_login: true,
      }
      return fbUser
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('fb user info request error');
    })
  // console.log('facebook user:', facebookUser)
  dbOauth(res, facebookUser);
}

const oauthTwitter = async (req, res) => {
  const authorization_enc = Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`, 'utf8').toString('base64');
  const access_token = await axios({
    method: 'post',
    url: `https://api.twitter.com/2/oauth2/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authorization_enc}`
    },
    data: qs.stringify({
      code: req.query.code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URL_NGROK,
      code_verifier: req.query.verifier
    })
  })
    .then((response) => {
      return response.data.access_token
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('twitter token request error');
    })
  // console.log('token ready:', access_token);
  const twitterUser = await axios({
    method: 'get',
    url: `https://api.twitter.com/2/users/me?user.fields=profile_image_url%2Cdescription`,
    headers: {
      Authorization: `Bearer ${access_token}`,
    }
  })
    .then((response) => {
      const twitUser = {
        oauth_id: `twitter=${response.data.data.id}`,
        email: '',
        password: '',
        phone: '',
        bio: response.data.data.description,
        name: response.data.data.name,
        picture_url: response.data.data.profile_image_url,
        oauth_login: true,
      }
      return twitUser
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send('twitter user data request error');
    })
  dbOauth(res, twitterUser)
}

module.exports = {
  register,
  login,
  editProfile,
  deleteAccount,
  oauthGithub,
  oauthGoogle,
  oauthFacebook,
  oauthTwitter
}