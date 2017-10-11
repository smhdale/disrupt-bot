const express = require('express')
const https = require('https')
const bodyParser = require('body-parser')
const fs = require('fs')

const api = require('./api')
const db = require('./db')
const paths = require('./paths')
const disrupt = require('./disrupt')

/**
 * Dates
 */

const EXHIBITION_DATE = new Date(2017, 10, 22)

function dateString (date) {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  ].map(_ => _.toString()).join('-')
}

// Returns -1 for days before exhibition day, 0 for exhibition day, 1 for days after
function exhibitionDayDiff () {
  let now = new Date()
  // Is it today?
  if (dateString(now) === dateString(EXHIBITION_DATE)) {
    return 0
  } else {
    let diff = now - EXHIBITION_DATE
    return diff / Math.abs(diff)
  }
}

/**
 * Message handling
 */

function getNLPEntity (nlp, name) {
  return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0]
}

function handleMessageReceived (event) {
  // Event data
  const senderID = event.sender.id
  const recipientID = event.recipient.id
  const timestamp = event.timestamp
  const message = event.message

  // Message data
  const messageID = message.mid
  const messageText = message.text
  const messageAttachments = message.attachments

  // Check for NLP entities
  const nlpGreeting = getNLPEntity(message.nlp, 'wit/greetings')
  const nlpIntent = getNLPEntity(message.nlp, 'intent')

  // Get sender's profile details
  getUser(senderID).then(user => {
    switch (nlpIntent) {
      case 'disrupt_user':
        // Disrupt the user's profile picture and send them an animated .gif
        return doProfileDisrupt(senderID)

      case 'exhibition_time':
        // Send info about the date and time of the exhibition
        return sendExhibitionDate(senderID)

      case 'exhibition_countdown':
        // Send number of days until exhibition starts,
        // handling day-of and days after
        return api.sendTextMessage(senderID, `I'm sorry, ${user.first_name}, I'm afraid I can't do that.`)

      default:
        return api.sendTextMessage(senderID, `I'm sorry, ${user.first_name}, I'm afraid I can't do that.`)
    }
  }).catch(console.error)
}

/**
 * Informs the user about what date the exhibition is happening on
 */
function sendExhibitionDate (fbid) {
  let date = ' on the 22nd of November, 2017.'
  switch (exhibitionDayDiff()) {
    case -1:
      date = 'will be taking place' + date
      break
    case 1:
      date = 'took place' + date
      break
    default:
      date = 'is happening today!'
      break
  }
  return api.sendTextMessage(senderID, `The QUT DISRUPT grad show ${date}`)
}

/**
 * Gives a countdown of days until the grad show
 */
function sendExhibitionCountdown (fbid) {

}

/**
 * Creates a disrupted, animated GIF version of the user's profile picture
 */
function doProfileDisrupt (fbid) {
  let progressMessage = api.sendTextMessage(senderID, 'Working on that...')
  let disruptedProfile = disrupt.disruptImage(senderID).then(filename => {
    return api.sendPictureMessage(senderID, paths.serve(filename))
  })

  return Promise.all([
    progressMessage,
    disruptedProfile
  ])
}

/**
 * User account handling
 */

// Attempt to get a user from the database, then
// fallback to the Graph API if not found
function getUser (fbid) {
  return new Promise((resolve, reject) => {
    db.getUser(fbid).then(user => {
      if (user !== null) {
        // User exists in DB
        resolve(user)
      } else {
        // User doesn't exist!
        api.lookupUser(fbid).then(user => {
          db.addUser(user).catch(console.error)
          resolve(user)
        }).catch(reject)
      }
    }).catch(reject)
  })
}

/**
 * App server settings
 */

const VERIFY_TOKEN = 'disrupt-2017-bot-verification-token'
const PORT = 2096
const APP = express()
const AUTH = {
  key: fs.readFileSync('certs/privatekey.pem'),
  cert: fs.readFileSync('certs/certificate.pem')
}

APP.use(bodyParser.json())
APP.use(express.static('images'))

APP.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log('Validating webhook')
    res.status(200).send(req.query['hub.challenge'])
  } else {
    console.error('Validation failed, make sure validation tokens match.')
    res.sendStatus(403)
  }
})

APP.post('/webhook', (req, res) => {
  const data = req.body
  if (data.object === 'page') {
    data.entry.forEach(entry => {
      let pageID = entry.id
      let timeOfEvent = entry.time

      // Handle every messaging event
      entry.messaging.forEach(event => {
        if (event.message) {
          handleMessageReceived(event)
        } else {
          console.log('Webhook received unknown event: ', event)
        }
      })
    })
  }

  res.sendStatus(200)
})

https.createServer(AUTH, APP).listen(PORT)
