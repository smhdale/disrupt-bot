const Canvas = require('canvas')
const Image = Canvas.Image
const GIFEncoder = require('gifencoder')
const fs = require('fs')

const db = require('./db')
const paths = require('./paths')

/**
 * Class for keeping track of bar coordinates
 */

class DisruptBar {
  constructor (sx, sy, sw, sh, dx, dy, dw, dh) {
    this.sx = sx
    this.sy = sy
    this.sw = sw
    this.sh = sh
    this.dx = dx
    this.dy = dy
    this.dw = dw
    this.dh = dh
  }
}

/**
 * Handle processing of disrupted images and text
 */

function getProfilePic (fbid) {
  let image = new Image()

  return new Promise((resolve, reject) => {
    fs.readFile(paths.image(`${fbid}.jpg`), (err, buffer) => {
      if (err) {
        reject(err)
      } else {
        image.onload = () => {
          resolve(image)
        }
        image.onerror = reject
        image.src = buffer
      }
    })
  })
}

const sin = x => .5 * Math.sin(2 * Math.PI * x)

function disruptImageSine (image, outputFile) {
  let gifSize = 300

  // Make canvas
  let canvas = new Canvas(gifSize, gifSize)
  let ctx = canvas.getContext('2d')

  // Create animated GIF
  let filename = outputFile + '.gif'
  let filepath = paths.image(filename)
  let encoder = new GIFEncoder(gifSize, gifSize)
  let stream = fs.createWriteStream(filepath)
  encoder.createReadStream().pipe(stream)
  encoder.start()
  encoder.setRepeat(0)
  encoder.setDelay(33)

  // Do animation
  let amp = 10
  let rows = 30
  let rowMod = 10
  let rowSrcH = image.height / rows
  let rowH = gifSize / rows
  let frames = 30
  for (let i = 0; i < frames; i++) {
    ctx.clearRect(0, 0, gifSize, gifSize)
    for (let row = 0; row < rows; row++) {
      let rowPos = (row % rowMod) / rowMod
      let dx = amp * sin(rowPos + i / frames)
      ctx.drawImage(image,
        0, row * rowSrcH, image.width, rowSrcH,
        dx, row * rowH, gifSize, rowH
      )
    }
    encoder.addFrame(ctx)
  }
  encoder.finish()

  // Save gif, return file path
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      resolve(filename)
    })
    stream.on('error', reject)
  })
}

function imageFromCanvas (canvas) {
  let img = new Image()
  return new Promise((resolve, reject) => {
    img.onload = () => {
      resolve(img)
    }
    img.onerror = reject
    img.src = canvas.toDataURL()
  })
}

function makeGreyscale (ctx) {
  let imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  let data = imgData.data
  for (let i = 0; i < data.length; i += 4) {
    let brightness = .34*data[i] + .5*data[i+1] + .16*data[i+2]
    imgData.data[i] = brightness
    imgData.data[i+1] = brightness
    imgData.data[i+2] = brightness
  }
  ctx.putImageData(imgData, 0, 0)
}

async function disruptImage (image, outputFile) {
  let gifSize = 300

  // Make canvas
  let canvas = new Canvas(gifSize, gifSize)
  let ctx = canvas.getContext('2d')

  // Create animated GIF
  let filename = outputFile + '.gif'
  let filepath = paths.image(filename)
  let encoder = new GIFEncoder(gifSize, gifSize)
  let stream = fs.createWriteStream(filepath)
  encoder.createReadStream().pipe(stream)
  encoder.start()
  encoder.setRepeat(0)
  encoder.setDelay(33)

  // Set up greyscale image
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, gifSize, gifSize)
  makeGreyscale(ctx)
  let greyscaleImage = await imageFromCanvas(canvas)

  // Create RGB images
  let colours = [ '#00f', '#f00', '#0f0' ]
  let imageLoads = []
  for (let colour of colours) {
    // Coloured background
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, gifSize, gifSize)

    // Multiply base image
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(greyscaleImage, 0, 0)

    // Save it
    imageLoads.push(imageFromCanvas(canvas))
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, gifSize, gifSize)

  // Wait until all channel images have loaded
  let channels = await Promise.all(imageLoads)

  // Animation setup
  let dxMax = 10
  let scale = (gifSize + dxMax * 2) / gifSize
  let barH = 1
  let numBars = gifSize / barH

  // Generate bars
  let bars = []
  for (let i = 0; i < numBars; i++) {
    bars.push(new DisruptBar(
      0, (dxMax + i * barH) / scale, gifSize, barH / scale,
      -dxMax, i * barH, gifSize * scale, barH
    ))
  }

  // Animation part 1 - sine wave
  let frames = 30
  let ampMod = true
  let amplitude
  let period = numBars / 6
  ctx.globalCompositeOperation = 'lighten'
  for (let i = 0; i < frames; i++) {
    ctx.clearRect(0, 0, gifSize, gifSize)

    let channelOffset
    let p
    let dx
    let bar

    // Randomly switch between amplitudes
    if (Math.random() < 0.12) {
      ampMod = !ampMod
    }
    amplitude = dxMax * (ampMod ? 0 : 0.75)

    // Draw each channel phase shifted by 1/3
    for (let c = 0; c < channels.length; c++) {
      channelOffset = c / channels.length * period
      for (let b = 0; b < numBars; b++) {
        p = ((b + channelOffset) % period) / period
        dx = amplitude * sin(p + i * 3 / frames)
        bar = bars[b]
        ctx.drawImage(channels[c],
          bar.sx, bar.sy, bar.sw, bar.sh,
          bar.dx + dx, bar.dy, bar.dw, bar.dh
        )
      }
    }

    encoder.addFrame(ctx)
  }
  ctx.globalCompositeOperation = 'source-over'

  // Finish animation and do clean-up
  encoder.finish()
  bars = []

  // Save gif, return file path
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      resolve(filename)
    })
    stream.on('error', reject)
  })
}

/**
 * Module public functions
 */

module.exports = {
  async disruptImage (fbid) {
    let image = await getProfilePic(fbid)
    return disruptImage(image, `${fbid}_disrupted`)
  }
}
