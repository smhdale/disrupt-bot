const express = require('express')
const https = require('https')
const bodyParser = require('body-parser')
const fs = require('fs')

const api = require('./api')
const db = require('./db')
const paths = require('./paths')
const disrupt = require('./disrupt')

const padZero = n => (n < 10 ? '0' : '') + n
function log (str) {
  let now = new Date()
  let y = now.getFullYear().toString().slice(2)
  let m = padZero(now.getMonth() + 1)
  let d = padZero(now.getDate())
  let h = padZero(now.getHours())
  let i = padZero(now.getMinutes())

  console.log(`[${d}-${m}-${y} ${h}:${i}] ${str}`)
}

/**
 * Exhibition info
 */

const MONTHS = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ]

const EXHIBITION = new function () {
  this.name = 'DISRUPT'
  this.date = new Date(2017, 10, 22)
  this.dateString = dateString(this.date)
  this.venue = 'QUT Creative Industries Precinct'
  this.location = '29 Musk Avenue, Kelvin Grove'
  this.locationLink = 'https://www.google.com/maps/place/QUT+Kelvin+Grove+Campus'
}

/**
 * Dates
 */

function dateStamp (date) {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  ].map(_ => _.toString()).join('-')
}

function dateString (date) {
  return MONTHS[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear()
}

function pluralise (n, str) {
  return (n === 1 ? str : str + 's')
}

function daysToExhibition () {
  let oneDay = 24*60*60*1000
  let now = new Date()
  now.setHours(0, 0, 0)

  return Math.ceil((EXHIBITION.date.getTime() - now.getTime()) / oneDay)
}

// Returns -1 for days before exhibition day, 0 for exhibition day, 1 for days after
function exhibitionDayDiff () {
  let now = new Date()
  // Is it today?
  if (dateStamp(now) === dateStamp(EXHIBITION.date)) {
    return 0
  } else {
    let diff = now - EXHIBITION.date
    return diff / Math.abs(diff)
  }
}

// Takes three tense strings and returns the one
// relevant to the exhibition date
function handleTense (before, dayOf, after) {
  switch (exhibitionDayDiff()) {
    case -1:
      return before
    case 0:
      return dayOf
    case 1:
      return after
    default:
      return ''
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

  const confidenceThreshold = 0.75

  // Get sender's profile details
  getUser(senderID).then(user => {
    log(`Message received from ${user.first_name} ${user.last_name}: ${messageText}`)

    if (nlpIntent && nlpIntent.confidence > confidenceThreshold) {
      switch (nlpIntent.value) {
        case 'disrupt_user':
          // Disrupt the user's profile picture and send them an animated .gif
          return doProfileDisrupt(senderID)

        case 'exhibition_time':
          // Send info about the date and time of the exhibition
          return sendExhibitionDate(senderID)

        case 'exhibition_countdown':
          // Send number of days until exhibition starts,
          // handling day-of and days after
          return sendExhibitionCountdown(senderID)

        case 'exhibition_location':
          // Send the location of the exhibition
          return sendExhibitionLocation(senderID)

        default:
          // Intent not handled
          return sendFallbackMessage(senderID)
      }
    } else {
      // Bot isn't confident enough with message intent
      return sendFallbackMessage(senderID)
    }
  }).catch(console.error)
}

/**
 * Informs the user about what date the exhibition is happening on
 */
function sendExhibitionDate (fbid) {
  let date = handleTense(
    `will take place on ${EXHIBITION.dateString}.`,
    'is happening today!',
    `took place on ${EXHIBITION.dateString}.`
  )
  return api.sendTextMessage(fbid, `The QUT ${EXHIBITION.name} grad show ${date}`)
}

/**
 * Gives a countdown of days until the grad show
 */
function sendExhibitionCountdown (fbid) {
  let days = daysToExhibition()
  let message

  // Special case for when exhibition is 0tomorrow
  if (days === 1) {
    message = 'The wait is almost over. Tomorrow, we DISRUPT.'
  } else {
    message = handleTense(
      `${days} ${pluralise(days, 'day')} remain until ${EXHIBITION.name}. Be prepared.`,
      'The wait is over. Today, we DISRUPT.',
      `It has been ${pluralise(-days, 'day')} days since ${EXHIBITION.name}.`
    )
  }

  return api.sendTextMessage(fbid, message)
}

/**
 * Returns the location of the DISRUPT exhibition, along with
 * a link to Google Maps
 */
function sendExhibitionLocation (fbid) {
  let tensePart = handleTense(
    'will be held',
    'is happening today',
    'was held'
  )

  let locationMessage = `The ${EXHIBITION.name} grad show ${tensePart} at the ${EXHIBITION.venue}, ${EXHIBITION.location}.`
  let locationLinkMessage = `Here it is on a map: ${EXHIBITION.locationLink}`

  // Send two messages because why not!
  return api.sendTextMessage(fbid, locationMessage).then(() => {
    return api.sendTextMessage(fbid, locationLinkMessage)
  })
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

function sendFallbackMessage (fbid) {
  return api.sendTextMessage(fbid, 'Sorry, I\'m not sure how to help with that.')
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
