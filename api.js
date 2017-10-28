const request = require('request')
const fs = require('fs')
const paths = require('./paths')

const ENDPOINT = 'https://graph.facebook.com/v2.6/'
const ACCESS_TOKEN = 'EAAOXIsHFTr4BADgrkb6KGKV2xzMaZAGR5ebYutTLQ5rA8VOpHXv1qYZCeQQgRtwApImZCTQ2NqLHstpVvkuRQ0pUlt5SBIcbF13G02F8ALVICtkhbKz85ytFF6E6dSOVlKtZCLrSbuZCCFonZAgNEfIqyYie9kutPte8mOaPnfvspK8HDAuhP7'

function get (endpoint, qs) {
  return {
    uri: endpoint,
    qs: Object.assign(qs, { access_token: ACCESS_TOKEN })
  }
}

function post (endpoint, body) {
  return {
    uri: endpoint,
    qs: { access_token: ACCESS_TOKEN },
    method: 'POST',
    json: body
  }
}

// Try and extract error out of Request response
function extractError (resp) {
  try {
    let body
    if (typeof resp.body === 'object') {
      body = resp.body
    } else {
      body = JSON.parse(resp.body)
    }
    if (body.hasOwnProperty('error') && body.error.hasOwnProperty('message')) {
      return body.error.message
    }
  } catch (e) {
    return JSON.stringify(resp)
  }
}

function markTyping (fbid) {
  return sendMessage({
    recipient: { id: fbid },
    sender_action: 'typing_on'
  })
}

function sendMessage (messageData) {
  let options = post(ENDPOINT + 'me/messages', messageData)
  return new Promise((resolve, reject) => {
    request(options, (err, resp, body) => {
      if (!err && resp.statusCode === 200) {
        // Message sent successfully!
        resolve(`Message sent to user ID ${body.recipient_id}.`)
      } else {
        let e = extractError(resp)
        reject(`Message send failed: ${e}`)
      }
    })
  })
}

function sendBotSettings (settings) {
  let options = post(ENDPOINT + 'me/messenger_profile', settings)
  return new Promise((resolve, reject) => {
    request(options, (err, resp, body) => {
      if (!err && resp.statusCode === 200) {
        resolve('Bot settings updated.')
      } else {
        let e = extractError(resp)
        reject(`Settings update failed: ${e}`)
      }
    })
  })
}

function makeCallToActions (arr) {
  return arr.map(option => {
    if (option.hasOwnProperty('call_to_actions')) {
      // Nested button
      return {
        title: option.title,
        call_to_actions: makeCallToActions(option.call_to_actions),
        type: 'nested'
      }
    } else if (option.hasOwnProperty('url')) {
      // Web link button
      return {
        title: option.title,
        url: option.url,
        type: 'web_url',
        webview_height_ratio: 'full'
      }
    }
    // Chat postback button
    return {
      title: option.title,
      payload: option.postback,
      type: 'postback'
    }
  })
}

module.exports = {
  // Message sending

  async sendTextMessage (fbid, messageText) {
    try {
      await markTyping(fbid)
      return sendMessage({
        recipient: { id: fbid },
        message: { text: messageText }
      })
    } catch (e) {
      console.error(e)
      return Promise.resolve()
    }
  },

  async sendPictureMessage (fbid, url) {
    try {
      await markTyping(fbid)
      return sendMessage({
        recipient: { id: fbid },
        message: {
          attachment: {
            type: 'image',
            payload: { url: url }
          }
        }
      })
    } catch (e) {
      console.error(e)
      return Promise.resolve()
    }
  },

  // User functions

  async lookupUser (fbid) {
    let options = get(ENDPOINT + fbid, {
      fields: 'first_name,last_name,profile_pic'
    })

    return new Promise((resolve, reject) => {
      request(options, (err, resp, body) => {
        if (!err && resp.statusCode === 200) {
          // User details downloaded
          let data = JSON.parse(body)

          // Download and store profile pic locally
          let picLocal = paths.image(`${fbid}.jpg`)
          request(data.profile_pic)
            .pipe(fs.createWriteStream(picLocal))
            .on('close', () => {
              data.pic_local = picLocal
              resolve(data)
            })
        } else {
          let e = extractError(resp)
          reject(`User lookup failed: ${e}`)
        }
      })
    })
  },

  // Bot settings

  setting_get_started (text) {
    return { payload: text }
  },

  setting_persistent_menu (options) {
    // options is an array of titles & payloads/urls
    return [
      {
        locale: 'default',
        call_to_actions: makeCallToActions(options)
      }
    ]
  },

  applyBotSettings (settings) {
    return sendBotSettings(settings)
  }
}
