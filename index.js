require('dotenv').config()
const logger = require('morgan')
const express = require('express')
const axios = require('axios')
const cors = require('cors')
const app = express()
const router = require('./router')

const passport = require('passport')
const GithubStrategy = require('passport-github').Strategy;

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_URL = 'https://github.com/login/oauth/access_token';

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
app.set('port', PORT);
app.set('env', NODE_ENV);
app.use(logger('tiny'));
app.use(express.json());
app.use(cors());

// passport.use(new GithubStrategy({
//   clientID: GITHUB_CLIENT_ID,
//   clientSecret: GITHUB_CLIENT_SECRET,
//   callbackURL: 'http://localhost:5127'
// },
//   function (accessToken, refreshToken, profile, cb) {
//     User.findOrCreate({ githubId: profile.id }, function (err, user) {
//       return cb(err, user);
//     });
//   }
// ));

app.post('/register', router.register);
app.post('/login', router.login);
app.post('/edit-profile', router.editProfile);

app.get('/login/federated/github', passport.authenticate('github'));
app.get('/oauth/redirect', router.oauthGithub);





app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(
    `Express Server started on Port ${app.get('port')} |
    Environment : ${app.get('env')}`
  );
});