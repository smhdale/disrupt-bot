const Pusher = require('pusher')

const PusherInstance = new Pusher({
  appId: '419748',
  key: '7dced3ef5a883a029dd6',
  secret: '5979ffd8dbd146a42595',
  cluster: 'ap1',
  encrypted: true
})

module.exports = {
  sendMessage (payload) {
    PusherInstance.trigger('messages', 'new-message', payload)
  }
}
