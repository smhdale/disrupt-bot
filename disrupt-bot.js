const express = require('express')
const https = require('https')
const bodyParser = require('body-parser')
const fs = require('fs')
const swearjar = require('swearjar')
const badWordsList = require('badwords-list').array

const api = require('./api')
const db = require('./db')
const paths = require('./paths')
const disrupt = require('./disrupt')
const pusher = require('./pusher')

const padZero = n => (n < 10 ? '0' : '') + n
function log (str) {
  let now = new Date()

  let date = [
    now.getFullYear() % 100,
    now.getMonth() + 1,
    now.getDate()
  ].map(padZero).join('-')

  let time = [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  ].map(padZero).join(':')

  console.log(`[${date} ${time}] ${str}`)
}

const choose = arr => arr[Math.floor(Math.random() * arr.length)]

/**
 * Bot settings
 */

async function initSettings () {
  let settings = {
    get_started: api.setting_get_started('SHOW_GREETING'),
    persistent_menu: api.setting_persistent_menu([
      { title: 'Disrupt me', postback: 'DISRUPT_USER' },
      { title: 'Send a disruption', postback: 'SEND_DISRUPTION' },
      {
        title: 'Visit website',
        url: 'https://d1srup7.com'
      }
    ])
  }
  try {
    await api.applyBotSettings(settings)
  } catch (e) {
    console.error(e)
  }
}

// initSettings()

/**
 * Exhibition info
 */

const DISRUPT_CODE = 'wearedisruptors'
const checkCode = msg => msg.toLowerCase() === DISRUPT_CODE

const MONTHS = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ]

const EXHIBITION = new function () {
  this.name = 'DISRUPT'
  this.startDate = new Date(2017, 10, 22)
  this.endDate = new Date(2017, 10, 23)
  this.daySpan = Math.abs(daysBetween(this.startDate, this.endDate)) + 1
  this.dateString = dateString(this.startDate)
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

function dateString (date, includeYear = true) {
  let str = MONTHS[date.getMonth()] + ' ' + date.getDate()
  if (includeYear) {
    str += ', ' + date.getFullYear()
  }
  return str
}

function pluralise (n, str) {
  let addS = (str.charAt(str.length - 1) !== 's')
  let pluralForm = (addS ? str + 's' : str.slice(0, str.length - 1))
  return (n === 1 ? str : pluralForm)
}

function daysBetween (d1, d2) {
  let oneDay = 24*60*60*1000
  return Math.ceil((d2.getTime() - d1.getTime()) / oneDay)
}

function daysToExhibition () {
  let now = new Date()
  now.setHours(0, 0, 0)
  return daysBetween(now, EXHIBITION.startDate)
}

function dayDiff (d1, d2) {
  if (dateStamp(d1) === dateStamp(d2)) {
    return 0
  }
  let diff = d1 - d2
  return diff / Math.abs(diff)
}

// Returns -1 for days before exhibition day, 0 for exhibition day, 1 for days after
function exhibitionDayDiff () {
  return dayDiff(new Date(), EXHIBITION.startDate)
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

function findBadWords (str) {
  let joiners = [ ' ', '.', ',', '-' ]

  for (let word of badWordsList) {
    let joinedWords = joiners.map(j => word.split('').join(j))
    for (let joinedWord of joinedWords) {
      if (str.includes(joinedWord)) {
        return true
      }
    }
  }
  return false
}

function detectProfanity (str) {
  return (swearjar.profane(str) || findBadWords(str))
}

function getNLPEntity (nlp, name) {
  return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0]
}

async function handleMessageReceived (event) {
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
  const nlpThanks = getNLPEntity(message.nlp, 'thanks')
  const nlpGreeting = getNLPEntity(message.nlp, 'greetings')
  const nlpIntent = getNLPEntity(message.nlp, 'intent')

  const confidenceThreshold = 0.75

  // Get sender's profile details
  let user = null
  try {
    user = await getUser(senderID)
  } catch (err) {
    log(`Error fetching user: ${err}`)
    return
  }

  log(`Message from ${user.first_name} ${user.last_name}: ${messageText}`)

  // First, detect and handle profanity
  if (detectProfanity(messageText)) {
    return handleInappropriateMessage(user)
  }

  // Next, check if we should be listening for the exhibition code
  if (user.await_code && user.await_code === 1) {
    // Validate the code
    let codeValue = 0
    let message = 'Sorry, that code isn\'t right. Use the menu to try again.'

    if (checkCode(messageText)) {
      codeValue = 2
      message = 'That\'s correct! Type something to send to the wall:'
    }

    try {
      await db.updateUser(user, { await_code: codeValue })
      if (codeValue === 2) {
        // Mark user's next message as a sendable message
        await db.updateUser(user, { send_disruption: true })
      }
    } catch (e) {
      console.error(e)
      return sendDisruptError(user.id)
    }
    return api.sendTextMessage(user.id, message)
  }

  // Next, check if we should be sending a disruption
  if (user.send_disruption && user.send_disruption === true) {
    try {
      await db.updateUser(user, { send_disruption: false })
      pusher.sendMessage({
        image: `${user.id}_disrupted.gif`,
        name: `${user.first_name} ${user.last_name}`,
        message: messageText
      })
      return api.sendTextMessage(user.id, 'Your disruption will show up soon. Watch the wall!')
    } catch (e) {
      console.error(e)
      return sendDisruptError(user.id)
    }
  }

  // Handle thanks or greeting if needed
  // Greeting should override thanks
  let didResponse = false
  if (nlpGreeting && nlpGreeting.confidence > confidenceThreshold) {
    await sendGreeting(user)
    didResponse = true
  } else if (nlpThanks && nlpThanks.confidence > confidenceThreshold) {
    await sendThanks(user)
    didResponse = true
  }

  // Handle message intent if needed
  if (nlpIntent && nlpIntent.confidence > confidenceThreshold) {
    switch (nlpIntent.value) {
      case 'exhibition_explanation':
        // Send an explanation of the exhibition
        return sendExhibitionExplanation(senderID)

      case 'exhibition_time':
        // Send info about the date and time of the exhibition
        return sendExhibitionDate(senderID)

      case 'exhibition_duration':
        // Send info about how long the exhibition will run for
        return sendExhibitionDuration(senderID)

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
    // Bot isn't confident enough with message intent and no greeting was sent
    if (!didResponse) {
      return sendFallbackMessage(senderID)
    }
  }
}

/**
 * Introductory message, shown to new users
 */
async function sendIntroMessage (user) {
  await api.sendTextMessage(user.id, `Welcome to ${EXHIBITION.name}, ${user.first_name}. We are disruptors; we inspire innovation, change, creativity. Join us on ${dateString(EXHIBITION.startDate, false)} to experience it for yourself at the QUT ${EXHIBITION.name} grad show.`)
  return api.sendTextMessage(user.id, 'Until then, we are here to help. Ask us anything about the exhibition and we\'ll do our best to answer you.')
}

/**
 * Sends a thanks message
 */
function sendThanks (user) {
  let message = choose([
    'Don\'t mention it. We are happy to help.',
    'Always happy to help a fellow disruptor.',
    `You're welcome, ${user.first_name}.`
  ])
  return api.sendTextMessage(user.id, message)
}

/**
 * Sends user a personalised greeting
 */
function sendGreeting (user) {
  let initialGreetings = [
    `Hello, ${user.first_name}. We hope you're feeling disruptive today.`,
    `Hello, disruptor. We're glad you're here.`
  ]
  let secondaryGreetings = [
    `Yes, hello ${user.first_name}. We see you.`,
    'You seem to like to say hello a lot.',
    `You've already said hi today, ${user.first_name}.`
  ]
  let returnGreetings = [
    `Welcome back, ${user.first_name}. We're glad to see you.`,
    `Hello again, ${user.first_name}. How can we help?`
  ]

  // Check if user has been greeted today
  let today = dateStamp(new Date())

  if (!user.hasOwnProperty('greeted_on')) {
    // Send initial greeting
    db.markGreetedOn(user, today)
    return api.sendTextMessage(user.id, choose(initialGreetings))
  } else if (user.greeted_on !== today) {
    // Send return greeting
    db.markGreetedOn(user, today)
    return api.sendTextMessage(user.id, choose([ ...initialGreetings, ...returnGreetings ]))
  }

  // Send secondary greeting - user has already said hello today!
  return api.sendTextMessage(user.id, choose(secondaryGreetings))
}

/**
 * Basic details about the exhibition
 */
async function sendExhibitionExplanation (fbid) {
  await api.sendTextMessage(fbid, `As designers, we ultimately design to disrupt. The QUT ${EXHIBITION.name} grad show is a showcase of our disruptive power across all disciplines of design.`)
  return api.sendTextMessage(fbid, 'Join us, QUT\'s Interactive and Visual Design graduating class of 2017, to experience it for yourself.')
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
 * Informs the user about the duration of the exhibition, including start and end dates
 */
function sendExhibitionDuration (fbid) {
  let message = `The ${EXHIBITION.name} exhibition `
  let duration = EXHIBITION.daySpan.toString() + ' ' + pluralise(EXHIBITION.daySpan, 'day')

  // Does the exhibition run for only one day?
  if (EXHIBITION.daySpan === 1) {
    message += handleTense(
      'will only last for one day.',
      'is on today only!',
      'only ran for one day.'
    )
  } else {
    let diff = exhibitionDayDiff()
    if (diff === -1) {
      message += `will span ${duration}, running from ${dateString(EXHIBITION.startDate, false)} to ${dateString(EXHIBITION.endDate)}.`
    } else if (diff === 0) {
      message += `starts today and will run for ${duration}, ending on ${dateString(EXHIBITION.endDate)}.`
    } else {
      // We have passed starting day
      let now = new Date()
      let daysLeft = Math.abs(daysBetween(now, EXHIBITION.endDate))
      let daysPast = EXHIBITION.daySpan - daysLeft
      switch (dayDiff(now, EXHIBITION.endDate)) {
        case -1:
          // Between start and end date
          message += `started ${daysPast} ${pluralise(daysPast, 'day')} ago, and will run for ${daysLeft} more ${pluralise(daysLeft, 'day')}.`
          break
        case 1:
          // After end date
          message += `ran for ${duration}, and finished on ${dateString(EXHIBITION.endDate)}.`
          break
        default:
          // On end date
          message += `is finishing today, after running for ${duration} from ${dateString(EXHIBITION.startDate)}`
          break
      }
    }
  }

  // Send message
  return api.sendTextMessage(fbid, message)
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
      `${days} ${pluralise(days, 'day')} ${pluralise(days, 'remains')} until ${EXHIBITION.name}. Be prepared.`,
      'The wait is over. Today, we DISRUPT.',
      `It has been ${-days} ${pluralise(-days, 'day')} since ${EXHIBITION.name}.`
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

function handleInappropriateMessage (user) {
  let message = choose([
    `That isn't very nice, ${user.first_name}.`,
    `Watch your tone, ${user.first_name}.`,
    `Hey ${user.first_name}, think before saying that again.`
  ])

  return api.sendTextMessage(user.id, message)
}

function sendFallbackMessage (fbid) {
  return api.sendTextMessage(fbid, 'Sorry, we\'re not sure how to help with that.')
}

/**
 * SPECIAL DISRUPTION FUNCTIONS
 */

function doProfileDisrupt (fbid) {
  let progressMessage = api.sendTextMessage(fbid, 'Working on that...')
  let disruptedProfile = disrupt.disruptImage(fbid).then(filename => {
    return api.sendPictureMessage(fbid, paths.serve(filename))
  })

  return Promise.all([
    progressMessage,
    disruptedProfile
  ])
}

async function checkDisruptCode (user) {
  if (!user.await_code || user.await_code < 2) {
    // Add code listener flag to user account
    try {
      await db.updateUser(user, { await_code: 1 })
    } catch (e) {
      console.error(e)
      return sendDisruptError(user.id)
    }
    return api.sendTextMessage(user.id, `If you're at ${EXHIBITION.name}, enter the code on the projector wall to send your own disruption:`)
  } else {
    // If user has already entered code, skip this step
    try {
      await db.updateUser(user, { send_disruption: true })
    } catch (e) {
      console.error(e)
      return sendDisruptError(user.id)
    }
    return api.sendTextMessage(user.id, 'Type something to send to the wall:')
  }
}

function sendDisruptError (fbid) {
  return api.sendTextMessage(fbid, 'Sorry, something went wrong. Try doing that again.')
}

/**
 * User account handling
 */

// Attempt to get a user from the database, then
// fallback to the Graph API if not found
async function getUser (fbid) {
  // Check for user in local DB
  let user = await db.getUser(fbid)
  if (user !== null) {
    return user
  }

  // Download user from API
  user = await api.lookupUser(fbid)
  // Make sure we set the fbid from the sender ID!
  user.id = fbid
  db.addUser(user)

  // Disrupt user's profile pic
  disrupt.disruptImage(fbid)
  return user
}

/**
 * Postback handling
 */

async function handlePostbackReceived (event) {
  const senderID = event.sender.id
  const postback = event.postback.payload

  // Get sender's profile details
  let user = null
  try {
    user = await getUser(senderID)
  } catch (err) {
    log(`Error fetching user: ${err}`)
    return
  }

  log(`Postback from ${user.first_name} ${user.last_name}: ${postback}`)

  switch (postback) {
    case 'SHOW_GREETING':
      return sendIntroMessage(user)
    case 'DISRUPT_USER':
      return doProfileDisrupt(senderID)
    case 'SEND_DISRUPTION':
      return checkDisruptCode(user)
    default:
      log(`Unhandled postback type: ${postback}`)
      return
  }
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
APP.use(express.static('public'))
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
          handleMessageReceived(event).catch(console.error)
        } else if (event.postback) {
          handlePostbackReceived(event)
        } else {
          log('Webhook received unknown event: ', event)
        }
      })
    })
  }

  res.sendStatus(200)
})

https.createServer(AUTH, APP).listen(PORT)
