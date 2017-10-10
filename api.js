const request = require('request')

const ENDPOINT = 'https://graph.facebook.com/v2.6/'
const ACCESS_TOKEN = 'EAAOXIsHFTr4BAPsTeHYjC3e59YXU7QwyQjL7JIhkLpHZBkZCT8hsAYeKDpQv4fl3yDZCu7EzWcznZCAwKHXgG6MZCZCj09T1ZCUoskpKHhlIQI9J3KZBZAvpaInurSeVs2ZBQWm0FZCjhcNvM7Pfo0XYBkyNdC9ujdbtC9UtwIGpr7YuaWfZCpHYdu1W'

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
  let body = JSON.parse(resp.body)
  if (body.hasOwnProperty('error') && body.error.hasOwnProperty('message')) {
    return body.error.message
  }
  return ''
}

function sendMessage (messageData) {
  let options = post(ENDPOINT + `me/messages`, messageData)

  return new Promise((resolve, reject) => {
    request(options, (err, resp, body) => {
      if (!err && resp.statusCode === 200) {
        // Message sent successfully!
        resolve(`Message sent to user ID ${body.recipient_id}.`)
      } else {
        let e = extractError(resp)
        reject(`Message send failure: ${e}`)
      }
    })
  })
}

module.exports = {
  sendTextMessage (fbid, messageText) {
    return sendMessage({
      recipient: { id: fbid },
      message: { text: messageText }
    })
  },

  sendPictureMessage (fbid, url) {
    return sendMessage({
      recipient: { id: fbid },
      message: {
        attachment: {
          type: 'image',
          payload: { url: url }
        }
      }
    })
  },

  lookupUser (fbid) {
    let options = get(ENDPOINT + fbid, {
      fields: 'first_name,last_name,profile_pic'
    })

    return new Promise((resolve, reject) => {
      request(options, (err, resp, body) => {
        if (!err && resp.statusCode === 200) {
          // User details downloaded
          resolve(JSON.parse(body))
        } else {
          let e = extractError(resp)
          reject(`User lookup failed: ${e}`)
        }
      })
    })
  }
}
