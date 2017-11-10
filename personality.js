// Handle fun responses to common questions

const choose = arr => arr[Math.floor(Math.random() * arr.length)]

// First name   %first
// Last name    %last

const replies = {
  'robot': [ // Are you a robot?
    'Think of us as more of a ... disruptive force.',
    'We aren\'t exactly at liberty to say, %first.'
  ],

  'life_meaning': [ // What's the meaning of life?
    'What\'s the point of existence if you don\'t leave a mark? As disruptors, we have the power to change the world.',
    'To live is to disrupt, %first. We inspire change in the world around us; we design to make a difference.'
  ],

  'favourite_colour': [ // What's your favourite colour?
    'We like the chaos that comes from the disruption of colour.'
  ],

  'age': [ // How old are you?
    'Do you have to be a certain age to be a disruptor? We don\'t think so.',
    'Does it matter? We will get old and die, but our disruptive legacy will live on.'
  ],

  'love': [ // Do you love me? Do you have a boyfriend/girlfriend?
    'We do not feel love. We exist only to cause disruption.'
  ],

  'watching': [ // Can you see me? Are you watching me?
    'We have eyes everywhere, %first.',
    'We\'re not watching you - just looking out for you.',
    'All we see is your disruptive capability, %first.'
  ],

  'rate_me': [ // How do I look? Do you like my hair/clothes?
    'The only metric by which we can judge you is by how you disrupt those around you.',
    'We don\'t rate your appearance, %first. We only care about how you make a difference.'
  ],

  'marry_me': [ // Will you marry me?
    'Even if we wanted to, %first, we could not. We only live to disrupt.',
    'We are not here to get married. We are here to challenge what you call "normal".'
  ]
}

function addName (user, message) {
  return message.replace(/%first/g, user.first_name).replace(/%last/g, user.last_name)
}

module.exports = {
  getPersonalityResponse (user, type) {
    if (!replies.hasOwnProperty(type)) {
      return null
    }
    let message = choose(replies[type])
    return addName(user, message)
  }
}
