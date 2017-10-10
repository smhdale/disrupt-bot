const express = require('express')
const https = require('https')
const bodyParser = require('body-parser')
const fs = require('fs')

const api = require('./api')
const db = require('./db')

/**
 * Message handling
 */

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

  // Get sender's profile details
  getUser(senderID).then(user => {
    if (messageText) {
      api.sendTextMessage(senderID, `Hello, ${user.first_name} ${user.last_name}! Is this you?`).then(() => {
        return api.sendPictureMessage(senderID, user.profile_pic)
      }).catch(console.error)
    }
  }).catch(console.error)
}

/**
 * User account handling
 */

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
