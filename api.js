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

module.exports = {
  sendMessage (messageData) {
    let options = post(ENDPOINT + 'me/messages', messageData)
    request(options, (err, resp, body) => {
      if (!err && resp.statusCode === 200) {
        // Message sent successfully!
        console.log(`Message sent to user ID ${body.recipient_id}.`)
      } else {
        console.error(`Message send failure.`)
        console.error(resp)
        console.error(err)
      }
    })
  },

  lookupUser (fbid) {
    let options = get(ENDPOINT + fbid, {
      fields: 'first_name,last_name,picture'
    })
    request(options, (err, resp, body) => {
      if (!err && resp.statusCode === 200) {
        // User details downloaded
        console.dir(body)
      } else {
        console.error('User lookup failed.')
      }
    })
  }
}
