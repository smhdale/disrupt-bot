// PUSHER

Pusher.logToConsole = true;

class PusherInstance {
  constructor () {
    this._key = '7dced3ef5a883a029dd6'
    this._options = {
      cluster: 'ap1',
      encrypted: true
    }

    this._instance = new Pusher(this._key, this._options)
    this._subscriptions = {}
  }

  // Subscribe to a channel
  subscribe (channelName) {
    let channel = this._instance.subscribe(channelName)
    this._subscriptions[channelName] = channel
    return new Promise((resolve, reject) => {
      channel.bind('pusher:subscription_succeeded', resolve)
      channel.bind('pusher:subscription_failed', reject)
    })
  }

  bindEvent (channelName, eventName, callback) {
    if (this._subscriptions.hasOwnProperty(channelName)) {
      this._subscriptions[channelName].bind(eventName, callback)
    }
  }
}

function handleMessage (data) {
  console.log(`Message received: ${data.message}`)
  let div = document.createElement('div')
  let text = document.createTextNode(`${data.name} says: ${data.message}`)
  div.appendChild(text)
  document.getElementById('messages').appendChild(div)
}

const PUSHER = new PusherInstance()
PUSHER.subscribe('messages').then(() => {
  PUSHER.bindEvent('messages', 'new-message', handleMessage)
}).catch(e => {
  console.error(`Failed to subscribe to channel: ${e}`)
})